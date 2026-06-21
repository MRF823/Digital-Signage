import { Router } from 'express'
import { getDb } from '../db.js'

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

export default router
