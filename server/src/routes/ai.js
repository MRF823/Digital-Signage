import { Router } from 'express'
import { getDb } from '../db.js'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY lipsește din .env')
  return new Anthropic({ apiKey: key })
}

function buildSystemContext() {
  const db = getDb()
  const now = new Date()
  const since7d = new Date(now - 7 * 24 * 3600 * 1000).toISOString().slice(0, 19)
  const since24h = new Date(now - 24 * 3600 * 1000).toISOString().slice(0, 19)

  const agencies = db.prepare('SELECT id, name, city FROM agencies ORDER BY name').all()
  const tvs = db.prepare(`
    SELECT t.id, t.label, t.last_seen_at, a.name as agency_name, a.city
    FROM tvs t JOIN agencies a ON a.id = t.agency_id
    ORDER BY a.name, t.label
  `).all()
  const groups = db.prepare('SELECT id, name FROM groups ORDER BY name').all()
  const mediaCount = db.prepare('SELECT COUNT(*) as c FROM media').get().c
  const recentPlays = db.prepare(`
    SELECT agency_id, tv_label, original_name, played_at, duration_seconds
    FROM play_log WHERE played_at >= ? ORDER BY played_at DESC LIMIT 100
  `).all(since24h)
  const uptime7d = db.prepare(`
    SELECT agency_id, tv_label, connected_at, disconnected_at
    FROM tv_uptime WHERE connected_at >= ? ORDER BY connected_at DESC
  `).all(since7d)

  const nowIso = now.toISOString()
  const onlineTvs = tvs.filter(tv => {
    if (!tv.last_seen_at) return false
    return (now - new Date(tv.last_seen_at)) < 30000
  })

  return `Ești asistentul AI al platformei DisplayIQ — un sistem de digital signage pentru bănci.
Data și ora curentă: ${nowIso}

## Agenții (${agencies.length} total):
${agencies.map(a => `- ID ${a.id}: ${a.name}, ${a.city}`).join('\n')}

## TV-uri (${tvs.length} total, ${onlineTvs.length} online acum):
${tvs.map(tv => {
  const lastSeen = tv.last_seen_at ? new Date(tv.last_seen_at) : null
  const diffMin = lastSeen ? Math.round((now - lastSeen) / 60000) : null
  const status = !lastSeen ? 'niciodată conectat' : diffMin < 1 ? 'ONLINE' : `offline de ${diffMin} minute`
  return `- ${tv.agency_name} (${tv.city}) — ${tv.label}: ${status}`
}).join('\n')}

## Grupuri (${groups.length}):
${groups.map(g => `- ${g.name}`).join('\n')}

## Fișiere media: ${mediaCount} fișiere în librărie

## Redări în ultimele 24h (${recentPlays.length} înregistrări):
${recentPlays.slice(0, 30).map(p => `- ${p.agency_id}/${p.tv_label}: ${p.original_name} la ${p.played_at}`).join('\n')}
${recentPlays.length > 30 ? `... și încă ${recentPlays.length - 30} redări` : ''}

## Sesiuni uptime 7 zile (${uptime7d.length} sesiuni):
${uptime7d.slice(0, 20).map(u => `- ${u.agency_id}/${u.tv_label}: conectat ${u.connected_at}, deconectat ${u.disconnected_at || 'încă activ'}`).join('\n')}
${uptime7d.length > 20 ? `... și încă ${uptime7d.length - 20} sesiuni` : ''}

Răspunde în română. Fii concis și direct. Dacă nu știi ceva din datele de mai sus, spune că nu ai informația.`
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body
  if (!message) return res.status(400).json({ error: 'message lipsește' })

  try {
    const client = getClient()
    const systemPrompt = buildSystemContext()

    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })

    res.json({ reply: response.content[0].text })
  } catch (e) {
    console.error('[AI chat error]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/ai/anomalies — detectare anomalii
router.get('/anomalies', async (req, res) => {
  try {
    const db = getDb()
    const now = new Date()
    const since7d = new Date(now - 7 * 24 * 3600 * 1000).toISOString().slice(0, 19)
    const since24h = new Date(now - 24 * 3600 * 1000).toISOString().slice(0, 19)

    const tvs = db.prepare(`
      SELECT t.id, t.label, t.last_seen_at, a.name as agency_name, a.id as agency_id
      FROM tvs t JOIN agencies a ON a.id = t.agency_id
    `).all()

    const uptime7d = db.prepare(`
      SELECT agency_id, tv_label, connected_at, disconnected_at
      FROM tv_uptime WHERE connected_at >= ? ORDER BY connected_at
    `).all(since7d)

    const plays24h = db.prepare(`
      SELECT DISTINCT agency_id, tv_label FROM play_log WHERE played_at >= ?
    `).all(since24h)

    const playingTvs = new Set(plays24h.map(p => `${p.agency_id}::${p.tv_label}`))

    const anomalies = []

    // 1. TV-uri offline >2h în orele de program (09:00-18:00)
    for (const tv of tvs) {
      if (!tv.last_seen_at) {
        anomalies.push({
          type: 'never_connected',
          severity: 'warning',
          tv: tv.label,
          agency: tv.agency_name,
          message: `${tv.label} (${tv.agency_name}) nu s-a conectat niciodată`
        })
        continue
      }
      const diffH = (now - new Date(tv.last_seen_at)) / 3600000
      const hour = now.getHours()
      if (diffH > 2 && hour >= 9 && hour < 18) {
        anomalies.push({
          type: 'offline_business_hours',
          severity: 'error',
          tv: tv.label,
          agency: tv.agency_name,
          message: `${tv.label} (${tv.agency_name}) offline de ${Math.round(diffH)}h în orele de program`
        })
      }
    }

    // 2. TV-uri online (seen recent) dar fără redări în 24h
    for (const tv of tvs) {
      if (!tv.last_seen_at) continue
      const diffMin = (now - new Date(tv.last_seen_at)) / 60000
      if (diffMin < 30) {
        const key = `${tv.agency_id}::${tv.label}`
        if (!playingTvs.has(key)) {
          anomalies.push({
            type: 'online_no_plays',
            severity: 'warning',
            tv: tv.label,
            agency: tv.agency_name,
            message: `${tv.label} (${tv.agency_name}) e online dar nu a redat nimic în ultimele 24h`
          })
        }
      }
    }

    // 3. Analiză pattern deconectări — AI
    if (uptime7d.length > 5 && process.env.ANTHROPIC_API_KEY) {
      const client = getClient()
      const uptimeSummary = uptime7d.slice(0, 50).map(u =>
        `${u.agency_id}/${u.tv_label}: conectat ${u.connected_at.slice(11, 16)}, deconectat ${u.disconnected_at ? u.disconnected_at.slice(11, 16) : 'activ'} (${u.connected_at.slice(0, 10)})`
      ).join('\n')

      const aiResponse = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Analizează aceste sesiuni de uptime pentru TV-uri dintr-un sistem de digital signage bancar. Identifică maxim 3 anomalii sau pattern-uri îngrijorătoare (ex: deconectări la aceeași oră, TV-uri cu sesiuni foarte scurte, etc). Răspunde în română cu bullet points scurte, fără introducere.\n\n${uptimeSummary}`
        }]
      })

      anomalies.push({
        type: 'ai_pattern_analysis',
        severity: 'info',
        tv: null,
        agency: null,
        message: aiResponse.content[0].text
      })
    }

    res.json({ anomalies, generated_at: now.toISOString() })
  } catch (e) {
    console.error('[AI anomalies error]', e.message)
    res.status(500).json({ error: e.message })
  }
})

export default router
