import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { createReadStream, statSync } from 'fs'
import { getDb } from '../db.js'
import { UPLOADS_DIR, ensureUploadsDir, deleteFile } from '../storage.js'

const router = Router()

const ALLOWED_TYPES = {
  'video/mp4': 'video',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
}

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true)
    else cb(new Error('File type not allowed'))
  },
})

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM media ORDER BY created_at DESC').all()
  res.json(rows)
})

router.post('/upload', (req, res) => {
  ensureUploadsDir()
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const type = ALLOWED_TYPES[req.file.mimetype]
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO media (filename, original_name, type, size_bytes)
      VALUES (?, ?, ?, ?)
    `).run(req.file.filename, req.file.originalname, type, req.file.size)

    res.status(201).json(db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid))
  })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!media) return res.status(404).json({ error: 'Not found' })

  db.prepare('DELETE FROM playlist_items WHERE media_id = ?').run(media.id)
  db.prepare('DELETE FROM media WHERE id = ?').run(media.id)
  deleteFile(media.filename)
  res.status(204).end()
})

// Serve media file with Range support for video streaming (public — no auth needed)
export function serveFile(req, res) {
  const basename = path.basename(req.params.filename)
  if (basename !== req.params.filename) return res.status(400).json({ error: 'Invalid filename' })
  const filePath = path.join(UPLOADS_DIR, basename)

  const MIME_BY_EXT = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }
  const MIME_BY_TYPE = { 'video': 'video/mp4', 'image/jpeg': 'image/jpeg', 'image/png': 'image/png' }
  let contentType = MIME_BY_EXT[path.extname(basename).toLowerCase()]
  if (!contentType) {
    try {
      const row = getDb().prepare('SELECT original_name, type FROM media WHERE filename = ?').get(basename)
      if (row) {
        contentType = MIME_BY_EXT[path.extname(row.original_name).toLowerCase()]
          || MIME_BY_TYPE[row.type]
          || 'application/octet-stream'
      } else {
        contentType = 'application/octet-stream'
      }
    } catch { contentType = 'application/octet-stream' }
  }

  try {
    const stat = statSync(filePath)
    const range = req.headers.range

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1
      const chunkSize = end - start + 1

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      })
      createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': contentType })
      createReadStream(filePath).pipe(res)
    }
  } catch {
    res.status(404).json({ error: 'File not found' })
  }
}

export default router
