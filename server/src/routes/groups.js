import { Router } from 'express'
import { getDb } from '../db.js'
import { pushPlaylist } from '../websocket.js'

const router = Router()

function getGroupWithMembers(db, groupId) {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
  if (!group) return null
  const agencies = db.prepare(`
    SELECT a.* FROM agencies a
    JOIN group_members gm ON gm.agency_id = a.id
    WHERE gm.group_id = ?
    ORDER BY a.name
  `).all(groupId)
  const playlist = db.prepare(`
    SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
    FROM playlist_items pi
    JOIN media m ON m.id = pi.media_id
    WHERE pi.agency_id IN (
      SELECT agency_id FROM group_members WHERE group_id = ?
    )
    AND pi.agency_id = (SELECT MIN(agency_id) FROM group_members WHERE group_id = ?)
    ORDER BY pi.position
  `).all(groupId, groupId)
  return { ...group, agencies, playlist }
}

// GET /api/groups — list all groups with agencies and playlist
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const groups = db.prepare('SELECT * FROM groups ORDER BY name').all()
    res.json(groups.map(g => getGroupWithMembers(db, g.id)))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/groups/:id — update group settings (transition, power schedule)
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  const db = getDb()
  if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Group not found' })

  const { transition, power_on_time, power_off_time } = req.body

  if (transition !== undefined) {
    if (!['none', 'fade', 'slide', 'zoom'].includes(transition))
      return res.status(400).json({ error: 'Invalid transition' })
    db.prepare('UPDATE groups SET transition = ? WHERE id = ?').run(transition, id)
  }

  if (power_on_time !== undefined || power_off_time !== undefined) {
    const onTime = power_on_time || null
    const offTime = power_off_time || null
    db.prepare('UPDATE groups SET power_on_time = ?, power_off_time = ? WHERE id = ?').run(onTime, offTime, id)
  }

  res.json({ ok: true })
})

// POST /api/groups — create group
router.post('/', (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    const db = getDb()
    const result = db.prepare('INSERT INTO groups (name) VALUES (?)').run(name.trim())
    res.status(201).json(getGroupWithMembers(db, result.lastInsertRowid))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/groups/:id — delete group (agencies become ungrouped)
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
    const db = getDb()
    if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(id))
      return res.status(404).json({ error: 'Group not found' })
    db.transaction(() => {
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id)
      db.prepare('DELETE FROM groups WHERE id = ?').run(id)
    })()
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/groups/:id/agencies — add agency to group
router.post('/:id/agencies', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    const agencyId = parseInt(req.body.agency_id, 10)
    if (isNaN(groupId) || isNaN(agencyId))
      return res.status(400).json({ error: 'Invalid id' })

    const db = getDb()
    if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId))
      return res.status(404).json({ error: 'Group not found' })
    if (!db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId))
      return res.status(404).json({ error: 'Agency not found' })

    const alreadyInGroup = db.prepare('SELECT group_id FROM group_members WHERE agency_id = ?').get(agencyId)
    if (alreadyInGroup)
      return res.status(409).json({ error: 'Agency already in a group' })

    db.prepare('INSERT INTO group_members (group_id, agency_id) VALUES (?, ?)').run(groupId, agencyId)
    res.status(201).json(getGroupWithMembers(db, groupId))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/groups/:id/agencies/:agencyId — remove agency from group
router.delete('/:id/agencies/:agencyId', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(groupId) || isNaN(agencyId))
      return res.status(400).json({ error: 'Invalid id' })

    const db = getDb()
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND agency_id = ?').run(groupId, agencyId)
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/groups/:id/playlist — set playlist for all agencies in group
router.post('/:id/playlist', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid id' })

    const { items } = req.body
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' })

    for (const item of items) {
      if (!Number.isInteger(item.media_id) || item.media_id <= 0)
        return res.status(400).json({ error: 'Each item must have a valid media_id' })
    }

    const db = getDb()
    const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId)
    if (!group) return res.status(404).json({ error: 'Group not found' })

    const members = db.prepare('SELECT agency_id FROM group_members WHERE group_id = ?').all(groupId)
    if (members.length === 0)
      return res.status(400).json({ error: 'Group has no agencies' })

    // Validate media_ids exist
    for (const item of items) {
      if (!db.prepare('SELECT id FROM media WHERE id = ?').get(item.media_id))
        return res.status(400).json({ error: `media_id ${item.media_id} not found` })
    }

    const insert = db.prepare(`
      INSERT INTO playlist_items (agency_id, media_id, position, display_duration_seconds)
      VALUES (?, ?, ?, ?)
    `)

    db.transaction(() => {
      for (const { agency_id } of members) {
        db.prepare('DELETE FROM playlist_items WHERE agency_id = ?').run(agency_id)
        items.forEach((item, i) => {
          insert.run(agency_id, item.media_id, i, item.display_duration_seconds ?? null)
        })
      }
    })()

    // Fetch saved playlist (from first member — all are identical)
    const saved = db.prepare(`
      SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
      FROM playlist_items pi
      JOIN media m ON m.id = pi.media_id
      WHERE pi.agency_id = ?
      ORDER BY pi.position
    `).all(members[0].agency_id)

    // Push to all TVs of all agencies in group (include transition setting)
    const groupData = db.prepare('SELECT transition FROM groups WHERE id = ?').get(groupId)
    const transition = groupData?.transition || 'fade'
    for (const { agency_id } of members) {
      pushPlaylist(String(agency_id), saved, transition)
    }

    res.json(saved)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/groups/:id/playlist
router.get('/:id/playlist', (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10)
    if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid id' })

    const db = getDb()
    if (!db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId))
      return res.status(404).json({ error: 'Group not found' })

    const firstMember = db.prepare('SELECT agency_id FROM group_members WHERE group_id = ? LIMIT 1').get(groupId)
    if (!firstMember) return res.json([])

    const items = db.prepare(`
      SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
      FROM playlist_items pi
      JOIN media m ON m.id = pi.media_id
      WHERE pi.agency_id = ?
      ORDER BY pi.position
    `).all(firstMember.agency_id)

    res.json(items)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
