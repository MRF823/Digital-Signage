import { Router } from 'express'
import { getDb } from '../db.js'
import { getActivePlaylist } from '../playlist.js'
import { pushPlaylistForAgency } from '../websocket.js'

function extractTvType(name) {
  const m = name.match(/ - (.+)$/i)
  return m ? m[1].trim().toLowerCase() : null
}

function checkOverlap(db, agencyId, name, startDate, endDate, excludeId = null) {
  const tvType = extractTvType(name)
  let query = `SELECT id, name FROM campaigns WHERE agency_id = ? AND start_date < ? AND end_date > ?`
  const params = [agencyId, endDate, startDate]
  if (excludeId) { query += ` AND id != ?`; params.push(excludeId) }
  const existing = db.prepare(query).all(...params)
  return existing.find(c => extractTvType(c.name) === tvType) || null
}

const router = Router()

// GET toate campaniile pentru o agenție
router.get('/:agencyId', (req, res) => {
  try {
    const db = getDb()
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agency id' })

    const campaigns = db.prepare(`
      SELECT * FROM campaigns WHERE agency_id = ? ORDER BY start_date
    `).all(agencyId)

    const result = campaigns.map(c => ({
      ...c,
      items: db.prepare(`
        SELECT ci.*, m.filename, m.original_name, m.type, m.duration_seconds
        FROM campaign_items ci
        JOIN media m ON m.id = ci.media_id
        WHERE ci.campaign_id = ?
        ORDER BY ci.position
      `).all(c.id)
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET toate campaniile (toate agențiile)
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const campaigns = db.prepare(`
      SELECT c.*, a.name as agency_name FROM campaigns c
      JOIN agencies a ON a.id = c.agency_id
      ORDER BY c.start_date
    `).all()

    const result = campaigns.map(c => ({
      ...c,
      items: db.prepare(`
        SELECT ci.*, m.filename, m.original_name, m.type, m.duration_seconds
        FROM campaign_items ci
        JOIN media m ON m.id = ci.media_id
        WHERE ci.campaign_id = ?
        ORDER BY ci.position
      `).all(c.id)
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST creare campanie nouă
router.post('/', (req, res) => {
  try {
    const { agency_id, name, start_date, end_date, items } = req.body
    if (!agency_id || !name || !start_date || !end_date || !Array.isArray(items)) {
      return res.status(400).json({ error: 'agency_id, name, start_date, end_date, items sunt obligatorii' })
    }

    const db = getDb()

    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(agency_id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })

    const conflict = checkOverlap(db, agency_id, name, start_date, end_date)
    if (conflict) {
      return res.status(409).json({ error: `Există deja campania "${conflict.name}" cu același tip de TV în această perioadă.` })
    }

    for (const item of items) {
      const media = db.prepare('SELECT id FROM media WHERE id = ?').get(item.media_id)
      if (!media) return res.status(400).json({ error: `media_id ${item.media_id} not found` })
    }

    const campaignId = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO campaigns (agency_id, name, start_date, end_date)
        VALUES (?, ?, ?, ?)
      `).run(agency_id, name, start_date, end_date)

      const insertItem = db.prepare(`
        INSERT INTO campaign_items (campaign_id, media_id, position, display_duration_seconds)
        VALUES (?, ?, ?, ?)
      `)
      items.forEach((item, i) => {
        insertItem.run(result.lastInsertRowid, item.media_id, i, item.display_duration_seconds ?? null)
      })

      return result.lastInsertRowid
    })()

    pushPlaylistForAgency(String(agency_id))
    res.json({ id: campaignId, message: 'Campanie creată' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT editare campanie
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

    const { name, start_date, end_date, items } = req.body
    if (!name || !start_date || !end_date || !Array.isArray(items)) {
      return res.status(400).json({ error: 'name, start_date, end_date, items sunt obligatorii' })
    }
    if (end_date <= start_date) {
      return res.status(400).json({ error: 'Data de final trebuie să fie cel puțin o zi după data de start.' })
    }

    const campaign = db.prepare('SELECT id, agency_id FROM campaigns WHERE id = ?').get(id)
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

    const conflict = checkOverlap(db, campaign.agency_id, name, start_date, end_date, id)
    if (conflict) {
      return res.status(409).json({ error: `Există deja campania "${conflict.name}" cu același tip de TV în această perioadă.` })
    }

    for (const item of items) {
      const media = db.prepare('SELECT id FROM media WHERE id = ?').get(item.media_id)
      if (!media) return res.status(400).json({ error: `media_id ${item.media_id} not found` })
    }

    db.transaction(() => {
      db.prepare('UPDATE campaigns SET name = ?, start_date = ?, end_date = ? WHERE id = ?').run(name, start_date, end_date, id)
      db.prepare('DELETE FROM campaign_items WHERE campaign_id = ?').run(id)
      const insertItem = db.prepare('INSERT INTO campaign_items (campaign_id, media_id, position, display_duration_seconds) VALUES (?, ?, ?, ?)')
      items.forEach((item, i) => insertItem.run(id, item.media_id, i, item.display_duration_seconds ?? null))
    })()

    pushPlaylistForAgency(String(campaign.agency_id))
    res.json({ message: 'Campanie actualizată' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE campanie
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

    const campaign = db.prepare('SELECT agency_id FROM campaigns WHERE id = ?').get(id)
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

    db.transaction(() => {
      db.prepare('DELETE FROM campaign_items WHERE campaign_id = ?').run(id)
      db.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
    })()

    pushPlaylistForAgency(String(campaign.agency_id))
    res.json({ message: 'Campanie ștearsă' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { getActivePlaylist }

export default router
