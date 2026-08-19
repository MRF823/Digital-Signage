import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { initDb, getDb } from './db.js'
import { initWebSocket, pushReloadToAll, pushSyncMediaToAll, pushTriggerUpdate } from './websocket.js'
import mediaRoutes, { serveFile } from './routes/media.js'
import agencyRoutes from './routes/agencies.js'
import playlistRoutes from './routes/playlists.js'
import tvsRoutes from './routes/tvs.js'
import groupRoutes from './routes/groups.js'
import scheduleRoutes from './routes/schedules.js'
import campaignRoutes from './routes/campaigns.js'
import infoRoutes, { serveInfoFile } from './routes/info.js'
import settingsRoutes from './routes/settings.js'
import userRoutes from './routes/users.js'
import { loginHandler, requireAuth, requireOperator, requireAdmin } from './auth.js'
import rateLimit from 'express-rate-limit'
import { initScheduler } from './scheduler.js'
import aiRoutes from './routes/ai.js'
import { initRates, getCurrentRates } from './rates.js'
import { initForex, getCurrentForexRates } from './forex.js'

const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 })
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  skip: (req) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
  message: { error: 'Prea multe cereri. Încearcă din nou în câteva secunde.' }
})

const app = express()
const httpServer = createServer(app)

app.set('trust proxy', 1)
app.use(cors({ origin: true }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 200 }))
app.use(writeLimiter)

initDb()
initWebSocket(httpServer)
initScheduler()
initRates()
initForex()

app.post('/api/login', loginRateLimit, loginHandler)
app.get('/api/rates', (req, res) => res.json(getCurrentRates() || {}))
app.get('/api/forex/rates', (req, res) => res.json(getCurrentForexRates() || {}))
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19)
    const { count } = db.prepare('SELECT COUNT(*) as count FROM play_log WHERE played_at >= ?').get(since)
    res.json({ plays_24h: count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/play-log', requireAuth, (req, res) => {
  const { agency_id, from, to, limit = 200 } = req.query
  let sql = 'SELECT * FROM play_log WHERE 1=1'
  const params = []
  if (agency_id) { sql += ' AND agency_id = ?'; params.push(agency_id) }
  if (from)      { sql += ' AND played_at >= ?'; params.push(from) }
  if (to)        { sql += ' AND played_at <= ?'; params.push(to) }
  sql += ' ORDER BY played_at DESC LIMIT ?'
  params.push(Number(limit))
  try {
    res.json(getDb().prepare(sql).all(...params))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/reports/summary', requireAuth, (req, res) => {
  const { agency_id, from, to } = req.query
  const db = getDb()
  const params = []
  let where = 'WHERE 1=1'
  if (agency_id) { where += ' AND agency_id = ?'; params.push(agency_id) }
  if (from)      { where += ' AND played_at >= ?'; params.push(from) }
  if (to)        { where += ' AND played_at <= ?'; params.push(to) }
  try {
    const global = db.prepare(`SELECT COUNT(*) as total_plays, COALESCE(SUM(duration_seconds),0) as total_seconds, COUNT(DISTINCT filename) as unique_files FROM play_log ${where}`).get(...params)
    const byAgency = db.prepare(`SELECT agency_id, COUNT(*) as plays, COALESCE(SUM(duration_seconds),0) as total_seconds FROM play_log ${where} GROUP BY agency_id`).all(...params)
    const byFile = db.prepare(`SELECT filename, original_name, media_type, COUNT(*) as plays, COALESCE(SUM(duration_seconds),0) as total_seconds FROM play_log ${where} GROUP BY filename, original_name, media_type ORDER BY total_seconds DESC`).all(...params)
    const byAgencyFile = db.prepare(`SELECT agency_id, filename, original_name, COUNT(*) as plays, COALESCE(SUM(duration_seconds),0) as total_seconds FROM play_log ${where} GROUP BY agency_id, filename, original_name ORDER BY total_seconds DESC`).all(...params)
    res.json({ global, byAgency, byFile, byAgencyFile })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
app.get('/api/reports/uptime', requireAuth, (req, res) => {
  const { agency_id, tv_label, date } = req.query
  if (!agency_id || !tv_label || !date) return res.status(400).json({ error: 'agency_id, tv_label, date sunt obligatorii' })
  try {
    const db = getDb()
    // Ziua selectată în ora României (Europe/Bucharest = UTC+3 vara, UTC+2 iarna)
    const dayStartSqlUtc = new Date(`${date}T00:00:00+03:00`).toISOString().replace('T', ' ').slice(0, 19)
    const dayEndSqlUtc   = new Date(`${date}T23:59:59+03:00`).toISOString().replace('T', ' ').slice(0, 19)

    // Sesiuni care se suprapun cu ziua cerută
    const sessions = db.prepare(`
      SELECT connected_at, disconnected_at FROM tv_uptime
      WHERE agency_id = ? AND tv_label = ?
        AND connected_at <= ? AND (disconnected_at >= ? OR disconnected_at IS NULL)
      ORDER BY connected_at
    `).all(agency_id, tv_label, dayEndSqlUtc, dayStartSqlUtc)

    // Fără date — nu știm dacă TV-ul a funcționat
    if (sessions.length === 0) {
      return res.json({ date, agency_id, tv_label, no_data: true, offline_periods: [], total_online_seconds: 0, total_offline_seconds: 0 })
    }

    const clamp = (t, min, max) => t < min ? min : t > max ? max : t
    const toSec = t => new Date(t.replace(' ', 'T') + 'Z').getTime() / 1000
    // Afișează ora României (UTC+3 vara / EEST)
    const BUCHAREST_OFFSET = 3 * 3600 * 1000
    const fmt = sec => {
      const local = new Date(sec * 1000 + BUCHAREST_OFFSET)
      return local.toISOString().slice(11, 16) // HH:MM
    }
    const fmtDur = sec => {
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      return h > 0 ? `${h}h ${m}min` : `${m}min`
    }

    const dayStartSec = new Date(`${date}T00:00:00+03:00`).getTime() / 1000
    const dayEndSec   = new Date(`${date}T23:59:59+03:00`).getTime() / 1000
    const nowSec = Math.min(Date.now() / 1000, dayEndSec)

    // Perioadele online (clampate la ziua cerută)
    const onlinePeriods = sessions.map(s => ({
      from: clamp(toSec(s.connected_at), dayStartSec, dayEndSec),
      to: clamp(s.disconnected_at ? toSec(s.disconnected_at) : nowSec, dayStartSec, dayEndSec)
    })).filter(p => p.to > p.from)

    // Merge perioade suprapuse (ex: sesiuni multiple cu null disconnected_at)
    // înainte de a calcula totalul online — altfel se numără de mai multe ori
    const merged = []
    for (const p of onlinePeriods) {
      if (merged.length === 0 || p.from > merged[merged.length - 1].to + 1) {
        merged.push({ from: p.from, to: p.to })
      } else {
        merged[merged.length - 1].to = Math.max(merged[merged.length - 1].to, p.to)
      }
    }
    let totalOnlineSec = 0
    merged.forEach(p => { totalOnlineSec += p.to - p.from })

    // Offline = golurile ÎNTRE sesiuni (nu de la 00:00 dacă n-avem date)
    // Începem de la primul connect cunoscut, nu de la 00:00
    const trackingStart = onlinePeriods[0]?.from ?? nowSec
    const offline = []
    let cursor = trackingStart
    for (const p of onlinePeriods) {
      if (p.from > cursor + 30) offline.push({ from: cursor, to: p.from }) // ignoră gap-uri < 30s (reconectări rapide)
      cursor = Math.max(cursor, p.to)
    }
    // Dacă ultima sesiune e deschisă (connected, fără disconnect) — nu adăugăm offline după
    const lastSession = sessions[sessions.length - 1]
    if (lastSession.disconnected_at && cursor < nowSec) {
      offline.push({ from: cursor, to: nowSec })
    }

    const totalOfflineSec = offline.reduce((s, p) => s + (p.to - p.from), 0)

    res.json({
      date,
      agency_id,
      tv_label,
      no_data: false,
      tracking_start: fmt(trackingStart),
      total_online_seconds: Math.round(totalOnlineSec),
      total_online_formatted: fmtDur(totalOnlineSec),
      total_offline_seconds: Math.round(totalOfflineSec),
      total_offline_formatted: fmtDur(totalOfflineSec),
      offline_periods: offline.map(p => ({
        from: fmt(p.from),
        to: fmt(p.to),
        duration_seconds: Math.round(p.to - p.from),
        duration_formatted: fmtDur(p.to - p.from)
      }))
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// File serving is public — filenames are random UUIDs, not guessable; needed for <video> elements
app.get('/api/media/:filename', serveFile)
app.get('/api/info/file/:filename', serveInfoFile)

// Public endpoint for player — check if docs changed (no auth needed, filenames are random UUIDs)
app.get('/api/info/public/:agencyId', (req, res) => {
  try {
    const db = getDb()
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agencyId' })
    const docs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
    const row = db.prepare('SELECT info_rotation_seconds FROM agencies WHERE id = ?').get(agencyId)
    res.json({ docs, rotation_seconds: row?.info_rotation_seconds ?? 5 })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Upcoming campaign media — public, returnează filenames pentru campaniile care incep in urmatoarele `days` zile
app.get('/api/upcoming-media', (req, res) => {
  try {
    const db = getDb()
    const agencyId = req.query.agencyId
    const days = parseInt(req.query.days || '3', 10)
    if (!agencyId) return res.status(400).json({ error: 'agencyId required' })

    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)

    const campaigns = db.prepare(`
      SELECT id FROM campaigns
      WHERE agency_id = ? AND start_date > ? AND start_date <= ?
    `).all(agencyId, today, future)

    const files = []
    for (const c of campaigns) {
      const items = db.prepare(`
        SELECT m.filename, m.original_name, m.type, m.duration_seconds
        FROM campaign_items ci JOIN media m ON m.id = ci.media_id
        WHERE ci.campaign_id = ?
      `).all(c.id)
      files.push(...items)
    }

    res.json(files)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
app.use('/api/media', requireOperator, mediaRoutes)
app.use('/api/agencies', requireOperator, agencyRoutes)
app.use('/api/agencies', requireOperator, playlistRoutes)
app.use('/api/tvs', requireOperator, tvsRoutes)
app.use('/api/groups', requireOperator, groupRoutes)
app.use('/api/groups/:id/schedules', requireOperator, scheduleRoutes)
app.use('/api/campaigns', requireOperator, campaignRoutes)
app.use('/api/info', requireOperator, infoRoutes)
app.use('/api/settings', requireAdmin, settingsRoutes)
app.use('/api/ai', requireAuth, aiRoutes)
app.use('/api/users', userRoutes)
app.use('/api/auth', userRoutes)
app.post('/api/players/reload', requireOperator, (req, res) => {
  pushReloadToAll()
  res.json({ ok: true })
})

app.post('/api/players/sync-media', requireOperator, (req, res) => {
  pushSyncMediaToAll()
  res.json({ ok: true })
})

app.post('/api/players/trigger-update', requireOperator, (req, res) => {
  const count = pushTriggerUpdate()
  res.json({ ok: true, agents: count })
})

app.post('/api/players/reload-all', requireOperator, (req, res) => {
  pushReloadToAll()
  res.json({ ok: true })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


const playerDist = join(__dirname, '../../player/dist')
if (existsSync(playerDist)) {
  app.use('/player', express.static(playerDist))
  app.get(/^\/player/, (req, res) => {
    res.sendFile(join(playerDist, 'index.html'), err => {
      if (err) res.status(503).send('Player temporarily unavailable')
    })
  })
}

const dashDist = join(__dirname, '../../dashboard/dist')
if (existsSync(dashDist)) {
  app.use(express.static(dashDist))
  app.get(/.*/, (req, res) => {
    res.sendFile(join(dashDist, 'index.html'), err => {
      if (err) res.status(503).send('Dashboard temporarily unavailable')
    })
  })
}

export { app, httpServer }

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`))
}
