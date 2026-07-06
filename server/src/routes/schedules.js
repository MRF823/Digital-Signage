import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router({ mergeParams: true })

function getSlotWithItems(db, slotId) {
  const slot = db.prepare('SELECT * FROM schedule_slots WHERE id = ?').get(slotId)
  if (!slot) return null
  const items = db.prepare(`
    SELECT ssi.*, m.filename, m.original_name, m.type, m.duration_seconds
    FROM schedule_slot_items ssi
    JOIN media m ON m.id = ssi.media_id
    WHERE ssi.slot_id = ?
    ORDER BY ssi.position
  `).all(slotId)
  return { ...slot, days: slot.days.split(',').map(Number), items }
}

// GET /api/groups/:id/schedules
router.get('/', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid id' })
    const db = getDb()
    const slots = db.prepare('SELECT * FROM schedule_slots WHERE group_id = ? ORDER BY start_time').all(groupId)
    res.json(slots.map(s => getSlotWithItems(db, s.id)))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/groups/:id/schedules
router.post('/', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid id' })
    const { name, days, start_time, end_time, items } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: 'days required' })
    if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time required' })
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' })

    const db = getDb()
    if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId))
      return res.status(404).json({ error: 'Group not found' })

    const result = db.transaction(() => {
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO schedule_slots (group_id, name, days, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
      ).run(groupId, name.trim(), days.join(','), start_time, end_time)

      const insertItem = db.prepare(
        'INSERT INTO schedule_slot_items (slot_id, media_id, position, display_duration_seconds) VALUES (?, ?, ?, ?)'
      )
      items.forEach((item, i) => {
        insertItem.run(lastInsertRowid, item.media_id, i, item.display_duration_seconds ?? null)
      })
      return lastInsertRowid
    })()

    res.status(201).json(getSlotWithItems(db, result))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/groups/:id/schedules/:slotId
router.put('/:slotId', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    const slotId = parseInt(req.params.slotId, 10)
    if (isNaN(groupId) || isNaN(slotId)) return res.status(400).json({ error: 'Invalid id' })
    const { name, days, start_time, end_time, items } = req.body

    const db = getDb()
    if (!db.prepare('SELECT id FROM schedule_slots WHERE id = ? AND group_id = ?').get(slotId, groupId))
      return res.status(404).json({ error: 'Slot not found' })

    db.transaction(() => {
      db.prepare('UPDATE schedule_slots SET name=?, days=?, start_time=?, end_time=? WHERE id=?')
        .run(name.trim(), days.join(','), start_time, end_time, slotId)
      db.prepare('DELETE FROM schedule_slot_items WHERE slot_id = ?').run(slotId)
      const insertItem = db.prepare(
        'INSERT INTO schedule_slot_items (slot_id, media_id, position, display_duration_seconds) VALUES (?, ?, ?, ?)'
      )
      items.forEach((item, i) => {
        insertItem.run(slotId, item.media_id, i, item.display_duration_seconds ?? null)
      })
    })()

    res.json(getSlotWithItems(db, slotId))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/groups/:id/schedules/:slotId
router.delete('/:slotId', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    const slotId = parseInt(req.params.slotId, 10)
    if (isNaN(groupId) || isNaN(slotId)) return res.status(400).json({ error: 'Invalid id' })
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM schedule_slot_items WHERE slot_id = ?').run(slotId)
      db.prepare('DELETE FROM schedule_slots WHERE id = ? AND group_id = ?').run(slotId, groupId)
    })()
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
