import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const db = getDb()
    const agencies = db.prepare('SELECT * FROM agencies ORDER BY city').all()
    const result = agencies.map(agency => ({
      ...agency,
      tvs: db.prepare('SELECT * FROM tvs WHERE agency_id = ?').all(agency.id),
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', (req, res) => {
  try {
    const { name, city } = req.body
    if (!name?.trim() || !city?.trim()) return res.status(400).json({ error: 'name and city required' })

    const db = getDb()
    const result = db.prepare('INSERT INTO agencies (name, city) VALUES (?, ?)').run(name.trim(), city.trim())
    const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ ...agency, tvs: [] })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(req.params.id)
    if (!agency) return res.status(404).json({ error: 'Not found' })

    db.transaction(() => {
      db.prepare('DELETE FROM playlist_items WHERE agency_id = ?').run(agency.id)
      db.prepare('DELETE FROM tvs WHERE agency_id = ?').run(agency.id)
      db.prepare('DELETE FROM agencies WHERE id = ?').run(agency.id)
    })()

    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/tvs', (req, res) => {
  try {
    const { label } = req.body
    if (!label?.trim()) return res.status(400).json({ error: 'label required' })

    const db = getDb()
    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(req.params.id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })

    const result = db.prepare('INSERT INTO tvs (agency_id, label) VALUES (?, ?)').run(agency.id, label.trim())
    const tv = db.prepare('SELECT * FROM tvs WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(tv)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
