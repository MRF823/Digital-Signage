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
    if (db.prepare('SELECT id FROM agencies WHERE LOWER(name) = LOWER(?)').get(name.trim()))
      return res.status(409).json({ error: 'Există deja o agenție cu acest nume' })
    const result = db.prepare('INSERT INTO agencies (name, city) VALUES (?, ?)').run(name.trim(), city.trim())
    const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ ...agency, tvs: [] })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/name', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
    const { name, city } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    const db = getDb()
    if (!db.prepare('SELECT id FROM agencies WHERE id = ?').get(id))
      return res.status(404).json({ error: 'Not found' })
    const duplicate = db.prepare('SELECT id FROM agencies WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), id)
    if (duplicate) return res.status(409).json({ error: 'Există deja o agenție cu acest nume' })
    db.prepare('UPDATE agencies SET name = ?' + (city ? ', city = ?' : '') + ' WHERE id = ?').run(
      ...(city ? [name.trim(), city.trim(), id] : [name.trim(), id])
    )
    const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(id)
    const tvs = db.prepare('SELECT * FROM tvs WHERE agency_id = ?').all(id)
    res.json({ ...agency, tvs })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid agency id' })

    const db = getDb()
    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(id)
    if (!agency) return res.status(404).json({ error: 'Not found' })

    db.transaction(() => {
      db.prepare('DELETE FROM playlist_items WHERE agency_id = ?').run(id)
      db.prepare('DELETE FROM tvs WHERE agency_id = ?').run(id)
      db.prepare('DELETE FROM agencies WHERE id = ?').run(id)
    })()

    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/coords', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { lat, lng } = req.body
    if (isNaN(id) || lat == null || lng == null) return res.status(400).json({ error: 'lat and lng required' })
    const db = getDb()
    db.prepare('UPDATE agencies SET lat = ?, lng = ? WHERE id = ?').run(lat, lng, id)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/tvs', (req, res) => {
  try {
    const { label, orientation = 'landscape' } = req.body
    if (!label?.trim()) return res.status(400).json({ error: 'label required' })
    const orient = orientation === 'portrait' ? 'portrait' : 'landscape'

    const db = getDb()
    const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(req.params.id)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })

    const result = db.prepare('INSERT INTO tvs (agency_id, label, orientation) VALUES (?, ?, ?)').run(agency.id, label.trim(), orient)
    const tv = db.prepare('SELECT * FROM tvs WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(tv)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/tvs/:tvId', (req, res) => {
  try {
    const db = getDb()
    const tv = db.prepare('SELECT id FROM tvs WHERE id = ? AND agency_id = ?').get(req.params.tvId, req.params.id)
    if (!tv) return res.status(404).json({ error: 'TV not found' })
    const { orientation } = req.body
    const orient = orientation === 'portrait' ? 'portrait' : 'landscape'
    db.prepare('UPDATE tvs SET orientation = ? WHERE id = ?').run(orient, tv.id)
    res.json(db.prepare('SELECT * FROM tvs WHERE id = ?').get(tv.id))
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
