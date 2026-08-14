import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT key, value FROM settings').all()
    const obj = Object.fromEntries(rows.map(r => [r.key, r.value]))
    res.json(obj)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/', (req, res) => {
  const allowed = ['alert_email']
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return res.status(400).json({ error: 'No valid keys' })
  try {
    const stmt = getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    for (const [key, value] of updates) stmt.run(key, String(value))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
