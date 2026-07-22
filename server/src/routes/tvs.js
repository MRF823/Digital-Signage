import { Router } from 'express'
import { getDb } from '../db.js'
import { pushForexMode } from '../websocket.js'

const router = Router()

router.delete('/:tvId', (req, res) => {
  try {
    const db = getDb()
    const tv = db.prepare('SELECT id FROM tvs WHERE id = ?').get(req.params.tvId)
    if (!tv) return res.status(404).json({ error: 'TV not found' })
    db.prepare('DELETE FROM tvs WHERE id = ?').run(tv.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/forex', (req, res) => {
  const db = getDb()
  const tvs = db.prepare(`
    SELECT t.id, t.label, t.agency_id, t.forex_mode, t.last_seen_at, a.name as agency_name, a.city
    FROM tvs t
    JOIN agencies a ON a.id = t.agency_id
    ORDER BY a.name, t.label
  `).all()
  res.json(tvs)
})

router.patch('/:tvId/forex', (req, res) => {
  const db = getDb()
  const tv = db.prepare('SELECT * FROM tvs t JOIN agencies a ON a.id = t.agency_id WHERE t.id = ?').get(req.params.tvId)
  if (!tv) return res.status(404).json({ error: 'TV not found' })
  const forex_mode = req.body.forex_mode ? 1 : 0
  db.prepare('UPDATE tvs SET forex_mode = ? WHERE id = ?').run(forex_mode, tv.id)
  pushForexMode(tv.agency_id, tv.label, forex_mode === 1)
  res.json({ ok: true, forex_mode })
})

export default router
