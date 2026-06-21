import { Router } from 'express'
import { getDb } from '../db.js'
import { pushPlaylist } from '../websocket.js'

const router = Router()

router.get('/:id/playlist', (req, res) => {
  const items = getDb().prepare(`
    SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
    FROM playlist_items pi
    JOIN media m ON m.id = pi.media_id
    WHERE pi.agency_id = ?
    ORDER BY pi.position
  `).all(req.params.id)
  res.json(items)
})

router.post('/:id/playlist', (req, res) => {
  const { items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })

  const db = getDb()
  const agencyId = parseInt(req.params.id)
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
})

export default router
