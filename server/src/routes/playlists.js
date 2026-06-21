import { Router } from 'express'
import { getDb } from '../db.js'
import { pushPlaylist } from '../websocket.js'

const router = Router()

router.get('/:id/playlist', (req, res) => {
  try {
    const db = getDb()
    const agencyId = parseInt(req.params.id, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agency id' })

    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })

    const items = db.prepare(`
      SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
      FROM playlist_items pi
      JOIN media m ON m.id = pi.media_id
      WHERE pi.agency_id = ?
      ORDER BY pi.position
    `).all(agencyId)
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/playlist', (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })

    const agencyId = parseInt(req.params.id, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agency id' })

    const db = getDb()

    for (const item of items) {
      if (!Number.isInteger(item.media_id) || item.media_id <= 0) {
        return res.status(400).json({ error: 'Each item must have a valid media_id' })
      }
      if (item.display_duration_seconds !== null && item.display_duration_seconds !== undefined) {
        if (typeof item.display_duration_seconds !== 'number' || item.display_duration_seconds <= 0) {
          return res.status(400).json({ error: 'display_duration_seconds must be a positive number or null' })
        }
      }
    }

    // Validate that each media_id exists in the database
    for (const item of items) {
      const media = db.prepare('SELECT id FROM media WHERE id = ?').get(item.media_id)
      if (!media) {
        return res.status(400).json({ error: `media_id ${item.media_id} not found` })
      }
    }
    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })

    db.transaction(() => {
      db.prepare('DELETE FROM playlist_items WHERE agency_id = ?').run(agencyId)
      const insert = db.prepare(`
        INSERT INTO playlist_items (agency_id, media_id, position, display_duration_seconds)
        VALUES (?, ?, ?, ?)
      `)
      items.forEach((item, i) => {
        insert.run(agencyId, item.media_id, i, item.display_duration_seconds ?? null)
      })
    })()

    const saved = db.prepare(`
      SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
      FROM playlist_items pi
      JOIN media m ON m.id = pi.media_id
      WHERE pi.agency_id = ?
      ORDER BY pi.position
    `).all(agencyId)

    pushPlaylist(String(agencyId), saved)
    res.json(saved)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
