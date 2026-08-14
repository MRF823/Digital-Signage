import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { existsSync } from 'fs'
import { getDb } from '../db.js'
import { UPLOADS_DIR, ensureUploadsDir, deleteFile } from '../storage.js'
import { pushInfoDocs, pushInfoPower, pushInfoMode } from '../websocket.js'

const router = Router()

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Doar fișiere PDF sunt permise'))
  },
})

// GET /api/info/:agencyId — lista documente + setări agenție
router.get('/:agencyId', (req, res) => {
  try {
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agencyId' })
    const db = getDb()
    const agency = db.prepare('SELECT id, info_rotation_seconds, info_on_time, info_off_time FROM agencies WHERE id = ?').get(agencyId)
    if (!agency) return res.status(404).json({ error: 'Agency not found' })
    const docs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
    res.json({
      docs,
      rotation_seconds: agency.info_rotation_seconds ?? 5,
      on_time: agency.info_on_time,
      off_time: agency.info_off_time,
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/info/:agencyId/upload — upload PDF (side: static|rotativ)
router.post('/:agencyId/upload', (req, res) => {
  const agencyId = parseInt(req.params.agencyId, 10)
  if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agencyId' })
  ensureUploadsDir()
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    const side = req.body.side === 'rotativ' ? 'rotativ' : 'static'
    const db = getDb()
    if (!db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId)) {
      deleteFile(req.file.filename)
      return res.status(404).json({ error: 'Agency not found' })
    }
    const maxPos = db.prepare('SELECT MAX(position) as m FROM info_docs WHERE agency_id = ? AND side = ?').get(agencyId, side)
    const position = (maxPos?.m ?? -1) + 1
    const result = db.prepare(`
      INSERT INTO info_docs (agency_id, side, filename, original_name, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(agencyId, side, req.file.filename, req.file.originalname, position)
    const doc = db.prepare('SELECT * FROM info_docs WHERE id = ?').get(result.lastInsertRowid)
    const allDocs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
    const agencyRow = db.prepare('SELECT info_rotation_seconds FROM agencies WHERE id = ?').get(agencyId)
    pushInfoDocs(agencyId, allDocs, agencyRow?.info_rotation_seconds ?? 5)
    res.status(201).json(doc)
  })
})

// DELETE /api/info/doc/:docId — șterge document
router.delete('/doc/:docId', (req, res) => {
  try {
    const docId = parseInt(req.params.docId, 10)
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid docId' })
    const db = getDb()
    const doc = db.prepare('SELECT * FROM info_docs WHERE id = ?').get(docId)
    if (!doc) return res.status(404).json({ error: 'Not found' })
    db.prepare('DELETE FROM info_docs WHERE id = ?').run(docId)
    deleteFile(doc.filename)
    const allDocs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(doc.agency_id)
    const agencyRow = db.prepare('SELECT info_rotation_seconds FROM agencies WHERE id = ?').get(doc.agency_id)
    pushInfoDocs(doc.agency_id, allDocs, agencyRow?.info_rotation_seconds ?? 5)
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/info/:agencyId/rotation — interval rotație (secunde)
router.put('/:agencyId/rotation', (req, res) => {
  try {
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agencyId' })
    const seconds = parseInt(req.body.seconds, 10)
    if (isNaN(seconds) || seconds < 1) return res.status(400).json({ error: 'seconds must be >= 1' })
    const db = getDb()
    if (!db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId))
      return res.status(404).json({ error: 'Agency not found' })
    db.prepare('UPDATE agencies SET info_rotation_seconds = ? WHERE id = ?').run(seconds, agencyId)
    const docs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
    pushInfoDocs(agencyId, docs, seconds)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/info/:agencyId/schedule — orar pornit/oprit
router.put('/:agencyId/schedule', (req, res) => {
  try {
    const agencyId = parseInt(req.params.agencyId, 10)
    if (isNaN(agencyId)) return res.status(400).json({ error: 'Invalid agencyId' })
    const { on_time, off_time } = req.body
    const db = getDb()
    if (!db.prepare('SELECT id FROM agencies WHERE id = ?').get(agencyId))
      return res.status(404).json({ error: 'Agency not found' })
    db.prepare('UPDATE agencies SET info_on_time = ?, info_off_time = ? WHERE id = ?')
      .run(on_time || null, off_time || null, agencyId)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/info/tv/:tvId/toggle — activează/dezactivează info_mode
router.post('/tv/:tvId/toggle', (req, res) => {
  try {
    const tvId = parseInt(req.params.tvId, 10)
    if (isNaN(tvId)) return res.status(400).json({ error: 'Invalid tvId' })
    const db = getDb()
    const tv = db.prepare('SELECT id, agency_id, label, info_mode FROM tvs WHERE id = ?').get(tvId)
    if (!tv) return res.status(404).json({ error: 'TV not found' })
    const newMode = tv.info_mode ? 0 : 1
    db.prepare('UPDATE tvs SET info_mode = ? WHERE id = ?').run(newMode, tvId)
    pushInfoMode(tv.agency_id, tv.label, newMode === 1)
    res.json({ ok: true, info_mode: newMode })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export function serveInfoFile(req, res) {
  const filename = path.basename(req.params.filename)
  const filePath = path.join(UPLOADS_DIR, filename)
  if (!existsSync(filePath)) return res.status(404).end()
  res.sendFile(path.resolve(filePath))
}

export default router
