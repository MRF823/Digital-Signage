# Digital Signage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full digital signage system — admin dashboard for uploading and distributing media to bank branch TVs, backend API with WebSocket push, and a React player running on Raspberry Pi in kiosk mode.

**Architecture:** Three independent apps in a monorepo: `server/` (Node.js + Express + SQLite + WebSocket), `dashboard/` (React + Vite + Tailwind), `player/` (React + Vite). The server handles file storage and pushes playlist updates to Pi devices in real time over WebSocket.

**Tech Stack:** Node.js 20, Express 4, better-sqlite3, ws, multer, jsonwebtoken, bcryptjs, React 18, Vite 5, TailwindCSS 3, react-router-dom 6, axios, react-dropzone, @dnd-kit/core (drag & drop)

---

## File Structure

```
digital-signage/
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js          # Express + WebSocket server entry point
│   │   ├── db.js             # SQLite connection + schema + seed
│   │   ├── auth.js           # bcrypt login + JWT middleware
│   │   ├── websocket.js      # WS server, client registry, push helper
│   │   ├── storage.js        # File system helpers for /uploads/
│   │   └── routes/
│   │       ├── media.js      # Upload, list, delete, serve media
│   │       ├── agencies.js   # List agencies with TV status
│   │       └── playlists.js  # Get/set playlist per agency
│   ├── uploads/              # (gitignored) media files
│   └── signage.db            # (gitignored) SQLite database
├── dashboard/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Router + auth guard
│       ├── api.js            # Axios instance + all API calls
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Content.jsx   # Upload + media library
│       │   ├── Agencies.jsx  # Agency cards + playlist modal
│       │   └── TVs.jsx       # TV status table
│       └── components/
│           ├── MediaCard.jsx
│           ├── AgencyCard.jsx
│           └── PlaylistModal.jsx
├── player/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Main player logic + playback loop
│       ├── useWebSocket.js   # WS connection with auto-reconnect
│       ├── usePlaylist.js    # Playlist state + localStorage persistence
│       ├── useMediaCache.js  # Download + cache media to IndexedDB
│       └── components/
│           ├── VideoPlayer.jsx
│           └── ImageDisplay.jsx
└── setup/
    ├── signage.service       # systemd unit for Pi
    ├── start-chromium.sh     # kiosk launcher script
    └── nginx.conf            # Nginx reverse proxy config
```

---

## Task 1: Monorepo scaffold + server setup

**Files:**
- Create: `server/package.json`
- Create: `server/src/index.js`
- Create: `.gitignore`

- [ ] **Step 1: Init server package**

```bash
cd /path/to/digital-signage
mkdir -p server/src/routes server/uploads
cd server
npm init -y
npm install express better-sqlite3 ws multer jsonwebtoken bcryptjs cors express-rate-limit
npm install --save-dev vitest supertest
```

- [ ] **Step 2: Create `.gitignore` in project root**

```
server/uploads/
server/signage.db
node_modules/
dist/
.env
```

- [ ] **Step 3: Write `server/src/index.js`**

```js
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { initDb } from './db.js'
import { initWebSocket } from './websocket.js'
import mediaRoutes from './routes/media.js'
import agencyRoutes from './routes/agencies.js'
import playlistRoutes from './routes/playlists.js'
import { requireAuth } from './auth.js'
import rateLimit from 'express-rate-limit'

const app = express()
const httpServer = createServer(app)

app.use(cors())
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 100 }))

initDb()
initWebSocket(httpServer)

app.use('/api/media', requireAuth, mediaRoutes)
app.use('/api/agencies', requireAuth, agencyRoutes)
app.use('/api/agencies', requireAuth, playlistRoutes)

export { app, httpServer }

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`))
}
```

- [ ] **Step 4: Add `"type": "module"` and scripts to `server/package.json`**

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add server/ .gitignore
git commit -m "feat: scaffold server project"
```

---

## Task 2: Database schema + seed

**Files:**
- Create: `server/src/db.js`
- Create: `server/src/db.test.js`

- [ ] **Step 1: Write failing test**

```js
// server/src/db.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { initDb, getDb } from './db.js'

beforeEach(() => { initDb(':memory:') })

describe('initDb', () => {
  it('creates all tables', () => {
    const db = getDb()
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name)
    expect(tables).toContain('media')
    expect(tables).toContain('agencies')
    expect(tables).toContain('tvs')
    expect(tables).toContain('playlist_items')
    expect(tables).toContain('admin')
  })

  it('seeds 10 agencies', () => {
    const db = getDb()
    const count = db.prepare('SELECT COUNT(*) as c FROM agencies').get()
    expect(count.c).toBe(10)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd server && npx vitest run src/db.test.js
```
Expected: `Error: Cannot find module './db.js'`

- [ ] **Step 3: Write `server/src/db.js`**

```js
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { existsSync, mkdirSync } from 'fs'

let db

export function initDb(path = './signage.db') {
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('video','image')),
      size_bytes INTEGER NOT NULL,
      duration_seconds REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      label TEXT NOT NULL,
      last_seen_at TEXT,
      ip_address TEXT
    );
    CREATE TABLE IF NOT EXISTS playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL REFERENCES agencies(id),
      media_id INTEGER NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL,
      display_duration_seconds REAL
    );
  `)

  // Seed admin if not exists
  const adminExists = db.prepare('SELECT id FROM admin LIMIT 1').get()
  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10)
    db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run('admin', hash)
  }

  // Seed agencies if not exists
  const agencyCount = db.prepare('SELECT COUNT(*) as c FROM agencies').get()
  if (agencyCount.c === 0) {
    const agencies = [
      { name: 'Agenția Centrală', city: 'București' },
      { name: 'Agenția Floreasca', city: 'București' },
      { name: 'Agenția Cluj-Napoca', city: 'Cluj-Napoca' },
      { name: 'Agenția Timișoara', city: 'Timișoara' },
      { name: 'Agenția Iași', city: 'Iași' },
      { name: 'Agenția Brașov', city: 'Brașov' },
      { name: 'Agenția Constanța', city: 'Constanța' },
      { name: 'Agenția Sibiu', city: 'Sibiu' },
      { name: 'Agenția Oradea', city: 'Oradea' },
      { name: 'Agenția Craiova', city: 'Craiova' },
    ]
    const insert = db.prepare('INSERT INTO agencies (name, city) VALUES (@name, @city)')
    const insertMany = db.transaction((rows) => rows.forEach(r => insert.run(r)))
    insertMany(agencies)

    // 2 TVs per agency
    const allAgencies = db.prepare('SELECT id FROM agencies').all()
    const tvInsert = db.prepare('INSERT INTO tvs (agency_id, label) VALUES (?, ?)')
    const tvTx = db.transaction((rows) => {
      rows.forEach(a => {
        tvInsert.run(a.id, 'TV-1')
        tvInsert.run(a.id, 'TV-2')
      })
    })
    tvTx(allAgencies)
  }
}

export function getDb() {
  return db
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd server && npx vitest run src/db.test.js
```
Expected: `2 tests passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/db.js server/src/db.test.js
git commit -m "feat: database schema and seed"
```

---

## Task 3: Authentication — login endpoint + JWT middleware

**Files:**
- Create: `server/src/auth.js`
- Create: `server/src/auth.test.js`

- [ ] **Step 1: Write failing test**

```js
// server/src/auth.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from './index.js'
import { initDb } from './db.js'

beforeEach(() => initDb(':memory:'))

describe('POST /api/login', () => {
  it('returns 200 and token with valid credentials', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
  })

  it('returns 401 with wrong password', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' })
    expect(res.status).toBe(401)
  })
})

describe('requireAuth middleware', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/media')
    expect(res.status).toBe(401)
  })

  it('allows requests with valid token', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
    const res = await request(app)
      .get('/api/agencies')
      .set('Authorization', `Bearer ${login.body.token}`)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd server && npx vitest run src/auth.test.js
```
Expected: `404` on login route (route not mounted yet)

- [ ] **Step 3: Write `server/src/auth.js`**

```js
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db.js'

const SECRET = process.env.JWT_SECRET || 'changeme-in-production'

export function loginHandler(req, res) {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' })

  const admin = getDb().prepare('SELECT * FROM admin WHERE username = ?').get(username)
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ sub: admin.id }, SECRET, { expiresIn: '24h' })
  res.json({ token })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try {
    jwt.verify(header.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
```

- [ ] **Step 4: Add login route to `server/src/index.js`**

Add after the imports and before the `app.use('/api/media', ...)` lines:

```js
import { loginHandler, requireAuth } from './auth.js'
// ...
app.post('/api/login', loginHandler)
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd server && npx vitest run src/auth.test.js
```
Expected: `4 tests passed`

- [ ] **Step 6: Commit**

```bash
git add server/src/auth.js server/src/auth.test.js server/src/index.js
git commit -m "feat: login endpoint and JWT auth middleware"
```

---

## Task 4: Media routes — upload, list, delete, serve

**Files:**
- Create: `server/src/storage.js`
- Create: `server/src/routes/media.js`
- Create: `server/src/routes/media.test.js`

- [ ] **Step 1: Write failing test**

```js
// server/src/routes/media.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { initDb, getDb } from '../db.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let token
beforeEach(async () => {
  initDb(':memory:')
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
  token = res.body.token
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/media', () => {
  it('returns empty array when no media', async () => {
    const res = await request(app).get('/api/media').set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('DELETE /api/media/:id', () => {
  it('returns 404 for non-existent media', async () => {
    const res = await request(app).delete('/api/media/999').set(auth())
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd server && npx vitest run src/routes/media.test.js
```
Expected: `Error: Cannot find module '../routes/media.js'`

- [ ] **Step 3: Write `server/src/storage.js`**

```js
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'

export const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads'

export function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })
}

export function deleteFile(filename) {
  const filePath = path.join(UPLOADS_DIR, filename)
  if (existsSync(filePath)) unlinkSync(filePath)
}
```

- [ ] **Step 4: Write `server/src/routes/media.js`**

```js
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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
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

// Serve media file with Range support (for video streaming)
router.get('/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename)
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
        'Content-Type': 'video/mp4',
      })
      createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Length': stat.size })
      createReadStream(filePath).pipe(res)
    }
  } catch {
    res.status(404).json({ error: 'File not found' })
  }
})

export default router
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd server && npx vitest run src/routes/media.test.js
```
Expected: `2 tests passed`

- [ ] **Step 6: Commit**

```bash
git add server/src/storage.js server/src/routes/media.js server/src/routes/media.test.js
git commit -m "feat: media upload, list, delete, serve routes"
```

---

## Task 5: Agency, TV, and Playlist routes

**Files:**
- Create: `server/src/routes/agencies.js`
- Create: `server/src/routes/tvs.js`
- Create: `server/src/routes/playlists.js`
- Create: `server/src/routes/agencies.test.js`
- Modify: `server/src/index.js` (mount tvs router)

- [ ] **Step 1: Write failing tests**

```js
// server/src/routes/agencies.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'
import { initDb, getDb } from '../db.js'

let token
beforeEach(async () => {
  initDb(':memory:')
  const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' })
  token = res.body.token
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/agencies', () => {
  it('returns 10 seeded agencies each with tvs array', async () => {
    const res = await request(app).get('/api/agencies').set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(10)
    expect(res.body[0]).toHaveProperty('tvs')
  })
})

describe('POST /api/agencies', () => {
  it('creates a new agency with no TVs', async () => {
    const res = await request(app)
      .post('/api/agencies')
      .set(auth())
      .send({ name: 'Agenția Test', city: 'Cluj' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Agenția Test')
    expect(res.body.tvs).toEqual([])
  })

  it('returns 400 when name or city missing', async () => {
    const res = await request(app).post('/api/agencies').set(auth()).send({ name: 'X' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/agencies/:id', () => {
  it('deletes agency and its TVs and playlist', async () => {
    // create a new agency to delete
    const created = await request(app)
      .post('/api/agencies').set(auth()).send({ name: 'Del', city: 'Y' })
    const id = created.body.id

    const res = await request(app).delete(`/api/agencies/${id}`).set(auth())
    expect(res.status).toBe(204)

    const check = await request(app).get('/api/agencies').set(auth())
    expect(check.body.find(a => a.id === id)).toBeUndefined()
  })
})

describe('POST /api/agencies/:id/tvs', () => {
  it('adds a TV to an agency', async () => {
    const res = await request(app)
      .post('/api/agencies/1/tvs')
      .set(auth())
      .send({ label: 'TV-Recepție' })
    expect(res.status).toBe(201)
    expect(res.body.label).toBe('TV-Recepție')
    expect(res.body.agency_id).toBe(1)
  })

  it('returns 400 when label missing', async () => {
    const res = await request(app).post('/api/agencies/1/tvs').set(auth()).send({})
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/tvs/:tvId', () => {
  it('deletes a TV', async () => {
    const db = getDb()
    const tv = db.prepare('SELECT id FROM tvs LIMIT 1').get()
    const res = await request(app).delete(`/api/tvs/${tv.id}`).set(auth())
    expect(res.status).toBe(204)
  })

  it('returns 404 for non-existent TV', async () => {
    const res = await request(app).delete('/api/tvs/99999').set(auth())
    expect(res.status).toBe(404)
  })
})

describe('POST /api/agencies/:id/playlist', () => {
  it('sets playlist and returns items', async () => {
    const db = getDb()
    const media = db.prepare(
      `INSERT INTO media (filename, original_name, type, size_bytes) VALUES ('f.mp4','orig.mp4','video',1000)`
    ).run()

    const res = await request(app)
      .post('/api/agencies/1/playlist')
      .set(auth())
      .send({ items: [{ media_id: media.lastInsertRowid, display_duration_seconds: null }] })

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].media_id).toBe(media.lastInsertRowid)
  })
})

describe('GET /api/agencies/:id/playlist', () => {
  it('returns empty array when no playlist set', async () => {
    const res = await request(app).get('/api/agencies/1/playlist').set(auth())
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd server && npx vitest run src/routes/agencies.test.js
```
Expected: route not found errors

- [ ] **Step 3: Write `server/src/routes/agencies.js`**

```js
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  const agencies = db.prepare('SELECT * FROM agencies ORDER BY city').all()
  const result = agencies.map(agency => ({
    ...agency,
    tvs: db.prepare('SELECT * FROM tvs WHERE agency_id = ?').all(agency.id),
  }))
  res.json(result)
})

router.post('/', (req, res) => {
  const { name, city } = req.body
  if (!name?.trim() || !city?.trim()) return res.status(400).json({ error: 'name and city required' })

  const db = getDb()
  const result = db.prepare('INSERT INTO agencies (name, city) VALUES (?, ?)').run(name.trim(), city.trim())
  const agency = db.prepare('SELECT * FROM agencies WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ ...agency, tvs: [] })
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(req.params.id)
  if (!agency) return res.status(404).json({ error: 'Not found' })

  db.transaction(() => {
    db.prepare('DELETE FROM playlist_items WHERE agency_id = ?').run(agency.id)
    db.prepare('DELETE FROM tvs WHERE agency_id = ?').run(agency.id)
    db.prepare('DELETE FROM agencies WHERE id = ?').run(agency.id)
  })()

  res.status(204).end()
})

router.post('/:id/tvs', (req, res) => {
  const { label } = req.body
  if (!label?.trim()) return res.status(400).json({ error: 'label required' })

  const db = getDb()
  const agency = db.prepare('SELECT id FROM agencies WHERE id = ?').get(req.params.id)
  if (!agency) return res.status(404).json({ error: 'Agency not found' })

  const result = db.prepare('INSERT INTO tvs (agency_id, label) VALUES (?, ?)').run(agency.id, label.trim())
  const tv = db.prepare('SELECT * FROM tvs WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(tv)
})

export default router
```

- [ ] **Step 4: Write `server/src/routes/tvs.js`**

```js
import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.delete('/:tvId', (req, res) => {
  const db = getDb()
  const tv = db.prepare('SELECT id FROM tvs WHERE id = ?').get(req.params.tvId)
  if (!tv) return res.status(404).json({ error: 'TV not found' })
  db.prepare('DELETE FROM tvs WHERE id = ?').run(tv.id)
  res.status(204).end()
})

export default router
```

- [ ] **Step 5: Write `server/src/routes/playlists.js`**

```js
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
```

- [ ] **Step 6: Mount tvs router in `server/src/index.js`**

Add after the existing `import playlistRoutes` line:

```js
import tvsRoutes from './routes/tvs.js'
// ...
app.use('/api/tvs', requireAuth, tvsRoutes)
```

- [ ] **Step 7: Run test — expect PASS**

```bash
cd server && npx vitest run src/routes/agencies.test.js
```
Expected: `8 tests passed`

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/agencies.js server/src/routes/tvs.js server/src/routes/playlists.js \
        server/src/routes/agencies.test.js server/src/index.js
git commit -m "feat: agency and TV CRUD routes, playlist get/set"
```

---

## Task 6: WebSocket server

**Files:**
- Create: `server/src/websocket.js`

- [ ] **Step 1: Write `server/src/websocket.js`**

(WebSocket is hard to unit-test without integration setup; manual test in Task 12.)

```js
import { WebSocketServer } from 'ws'
import { getDb } from './db.js'

// Map: agencyId -> Set of WebSocket clients
const clients = new Map()

export function initWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    let agencyId = null
    let tvId = null

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'register') {
        agencyId = String(msg.agencyId)
        tvId = msg.tvId

        if (!clients.has(agencyId)) clients.set(agencyId, new Set())
        clients.get(agencyId).add(ws)

        // Update TV last_seen_at and ip_address
        const ip = req.socket.remoteAddress
        getDb().prepare(`
          UPDATE tvs SET last_seen_at = datetime('now'), ip_address = ?
          WHERE agency_id = ? AND label = ?
        `).run(ip, agencyId, tvId)

        // Send current playlist immediately on connect
        const playlist = getDb().prepare(`
          SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
          FROM playlist_items pi
          JOIN media m ON m.id = pi.media_id
          WHERE pi.agency_id = ?
          ORDER BY pi.position
        `).all(agencyId)

        ws.send(JSON.stringify({ type: 'playlist_update', items: playlist }))
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        if (agencyId && tvId) {
          getDb().prepare(`UPDATE tvs SET last_seen_at = datetime('now') WHERE agency_id = ? AND label = ?`)
            .run(agencyId, tvId)
        }
      }
    })

    ws.on('close', () => {
      if (agencyId && clients.has(agencyId)) {
        clients.get(agencyId).delete(ws)
      }
    })
  })
}

export function pushPlaylist(agencyId, items) {
  const msg = JSON.stringify({ type: 'playlist_update', items })
  const agencyClients = clients.get(String(agencyId))
  if (!agencyClients) return
  for (const client of agencyClients) {
    if (client.readyState === 1) client.send(msg)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/websocket.js
git commit -m "feat: WebSocket server with client registry and push"
```

---

## Task 7: Dashboard — project setup + login page

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.js`
- Create: `dashboard/index.html`
- Create: `dashboard/src/main.jsx`
- Create: `dashboard/src/App.jsx`
- Create: `dashboard/src/api.js`
- Create: `dashboard/src/pages/Login.jsx`

- [ ] **Step 1: Init dashboard project**

```bash
cd /path/to/digital-signage
npm create vite@latest dashboard -- --template react
cd dashboard
npm install
npm install axios react-router-dom react-dropzone @dnd-kit/core @dnd-kit/sortable
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind — edit `dashboard/tailwind.config.js`**

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 3: Replace `dashboard/src/index.css` content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Write `dashboard/src/api.js`**

```js
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const login = (username, password) =>
  api.post('/api/login', { username, password }).then(r => r.data)

export const getMedia = () => api.get('/api/media').then(r => r.data)
export const uploadMedia = (file, onProgress) =>
  api.post('/api/media/upload', (() => { const f = new FormData(); f.append('file', file); return f })(), {
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  }).then(r => r.data)
export const deleteMedia = (id) => api.delete(`/api/media/${id}`)

export const getAgencies = () => api.get('/api/agencies').then(r => r.data)
export const createAgency = (name, city) => api.post('/api/agencies', { name, city }).then(r => r.data)
export const deleteAgency = (id) => api.delete(`/api/agencies/${id}`)
export const addTv = (agencyId, label) => api.post(`/api/agencies/${agencyId}/tvs`, { label }).then(r => r.data)
export const deleteTv = (tvId) => api.delete(`/api/tvs/${tvId}`)
export const getPlaylist = (agencyId) => api.get(`/api/agencies/${agencyId}/playlist`).then(r => r.data)
export const setPlaylist = (agencyId, items) =>
  api.post(`/api/agencies/${agencyId}/playlist`, { items }).then(r => r.data)

export const mediaUrl = (filename) => `${BASE}/api/media/${filename}`

export default api
```

- [ ] **Step 5: Write `dashboard/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Content from './pages/Content'
import Agencies from './pages/Agencies'
import TVs from './pages/TVs'

function Layout({ children }) {
  const navigate = useNavigate()
  const logout = () => { localStorage.removeItem('token'); navigate('/login') }
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-900 text-white px-6 py-3 flex items-center gap-8">
        <span className="font-bold text-blue-300 text-lg">BancaSign</span>
        {[['/', 'Conținut'], ['/agencies', 'Agenții'], ['/tvs', 'TV-uri']].map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => isActive ? 'text-white border-b-2 border-blue-400 pb-1' : 'text-blue-200 hover:text-white'}>
            {label}
          </NavLink>
        ))}
        <button onClick={logout} className="ml-auto text-blue-300 hover:text-white text-sm">Ieșire</button>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}

function AuthGuard({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout><Content /></Layout></AuthGuard>} />
        <Route path="/agencies" element={<AuthGuard><Layout><Agencies /></Layout></AuthGuard>} />
        <Route path="/tvs" element={<AuthGuard><Layout><TVs /></Layout></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Write `dashboard/src/pages/Login.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await login(username, password)
      localStorage.setItem('token', token)
      navigate('/')
    } catch {
      setError('Utilizator sau parolă incorectă.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">BancaSign</h1>
        {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <label className="block text-sm font-medium text-gray-700 mb-1">Utilizator</label>
        <input value={username} onChange={e => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
          {loading ? 'Se conectează...' : 'Intră în cont'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Update `dashboard/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
```

- [ ] **Step 8: Smoke test — start server + dashboard**

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd dashboard && npm run dev
```

Open `http://localhost:5173/login`, log in with `admin` / `admin123`. Expect redirect to `/`.

- [ ] **Step 9: Commit**

```bash
git add dashboard/
git commit -m "feat: dashboard scaffold, login page, API client"
```

---

## Task 8: Dashboard — Content page (upload + media library)

**Files:**
- Create: `dashboard/src/pages/Content.jsx`
- Create: `dashboard/src/components/MediaCard.jsx`

- [ ] **Step 1: Write `dashboard/src/components/MediaCard.jsx`**

```jsx
import { mediaUrl } from '../api'

export default function MediaCard({ item, onDelete }) {
  const isVideo = item.type === 'video'
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-100 h-32 flex items-center justify-center text-4xl">
        {isVideo ? '🎬' : '🖼️'}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 truncate" title={item.original_name}>
          {item.original_name}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {item.type} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB
          {item.duration_seconds ? ` · ${Math.round(item.duration_seconds)}s` : ''}
        </p>
        <button onClick={() => onDelete(item.id)}
          className="mt-2 text-xs text-red-500 hover:text-red-700">
          Șterge
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `dashboard/src/pages/Content.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { getMedia, uploadMedia, deleteMedia } from '../api'
import MediaCard from '../components/MediaCard'

export default function Content() {
  const [media, setMedia] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const load = () => getMedia().then(setMedia)
  useEffect(() => { load() }, [])

  const onDrop = useCallback(async (files) => {
    setError('')
    for (const file of files) {
      setProgress(0)
      try {
        await uploadMedia(file, setProgress)
        await load()
      } catch (e) {
        setError(e.response?.data?.error || 'Upload eșuat.')
      }
    }
    setProgress(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 500 * 1024 * 1024,
  })

  const handleDelete = async (id) => {
    if (!confirm('Ștergi acest fișier?')) return
    await deleteMedia(id)
    setMedia(m => m.filter(f => f.id !== id))
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Conținut Media</h2>

      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer mb-6 transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`}>
        <input {...getInputProps()} />
        <p className="text-3xl mb-2">⬆️</p>
        <p className="text-gray-500">Trage fișierele aici sau <span className="text-blue-600 underline">alege fișier</span></p>
        <p className="text-xs text-gray-400 mt-1">MP4, JPG, PNG — max 500MB</p>
      </div>

      {progress !== null && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-2 bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}% uploadat...</p>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {media.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Nicio înregistrare media. Încarcă primul fișier!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map(item => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manual test**

Start server + dashboard. Log in. Upload an MP4 and a JPG. Confirm they appear in the grid. Delete one. Confirm it disappears.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/pages/Content.jsx dashboard/src/components/MediaCard.jsx
git commit -m "feat: content page with upload and media library"
```

---

## Task 9: Dashboard — Agencies page + PlaylistModal + TV management

**Files:**
- Create: `dashboard/src/pages/Agencies.jsx`
- Create: `dashboard/src/components/AgencyCard.jsx`
- Create: `dashboard/src/components/PlaylistModal.jsx`

- [ ] **Step 1: Write `dashboard/src/components/PlaylistModal.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getMedia, setPlaylist } from '../api'

function SortableItem({ item, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2 shadow-sm">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400">⠿</span>
      <span className="text-lg">{item.type === 'video' ? '🎬' : '🖼️'}</span>
      <span className="text-sm flex-1 truncate">{item.original_name}</span>
      <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
    </div>
  )
}

export default function PlaylistModal({ agency, current, onClose, onSaved }) {
  const [allMedia, setAllMedia] = useState([])
  const [items, setItems] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getMedia().then(setAllMedia) }, [])

  const addItem = (media) => {
    if (items.find(i => i.media_id === media.id)) return
    setItems(prev => [...prev, {
      id: `new-${media.id}`,
      media_id: media.id,
      original_name: media.original_name,
      type: media.type,
      display_duration_seconds: media.type === 'image' ? 10 : null,
    }])
  }

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setItems(prev => {
      const from = prev.findIndex(i => i.id === active.id)
      const to = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  const save = async () => {
    setSaving(true)
    await setPlaylist(agency.id, items.map(i => ({
      media_id: i.media_id,
      display_duration_seconds: i.display_duration_seconds ?? null,
    })))
    onSaved()
    onClose()
  }

  const inPlaylist = new Set(items.map(i => i.media_id))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-800">Playlist — {agency.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Current playlist (sortable) */}
          <div className="flex-1 p-4 overflow-y-auto border-r">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Playlist curent (trage pentru reordonare)</p>
            {items.length === 0 && <p className="text-gray-400 text-sm">Niciun element. Adaugă din dreapta.</p>}
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {items.map(item => <SortableItem key={item.id} item={item} onRemove={removeItem} />)}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          {/* Media library to add */}
          <div className="w-56 p-4 overflow-y-auto bg-white">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Librărie media</p>
            <div className="flex flex-col gap-2">
              {allMedia.map(m => (
                <button key={m.id} onClick={() => addItem(m)} disabled={inPlaylist.has(m.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors
                    ${inPlaylist.has(m.id) ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                      : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200'}`}>
                  {m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">Anulează</button>
          <button onClick={save} disabled={saving}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `dashboard/src/components/AgencyCard.jsx`**

```jsx
import { useState } from 'react'
import PlaylistModal from './PlaylistModal'
import { addTv, deleteTv, deleteAgency } from '../api'

function tvStatus(tv) {
  if (!tv.last_seen_at) return { online: false, label: 'Niciodată conectat' }
  const diff = Date.now() - new Date(tv.last_seen_at + 'Z').getTime()
  return diff < 60_000
    ? { online: true, label: 'Online' }
    : { online: false, label: `Offline · ${Math.round(diff / 60_000)}m` }
}

export default function AgencyCard({ agency, onPlaylistSaved, onDeleted }) {
  const [showModal, setShowModal] = useState(false)
  const [addingTv, setAddingTv] = useState(false)
  const [tvLabel, setTvLabel] = useState('')
  const [tvError, setTvError] = useState('')

  const handleAddTv = async (e) => {
    e.preventDefault()
    setTvError('')
    if (!tvLabel.trim()) return setTvError('Introdu un nume pentru TV.')
    try {
      await addTv(agency.id, tvLabel.trim())
      setTvLabel('')
      setAddingTv(false)
      onPlaylistSaved() // reload
    } catch {
      setTvError('Eroare la adăugare TV.')
    }
  }

  const handleDeleteTv = async (tv) => {
    const { online } = tvStatus(tv)
    if (online) return alert('Nu poți șterge un TV care e online.')
    if (!confirm(`Ștergi ${tv.label}?`)) return
    await deleteTv(tv.id)
    onPlaylistSaved()
  }

  const handleDeleteAgency = async () => {
    if (!confirm(`Ștergi agenția "${agency.name}" și toate TV-urile și playlistul ei?`)) return
    await deleteAgency(agency.id)
    onDeleted()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">{agency.name}</h3>
          <p className="text-xs text-gray-400">{agency.city}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg">
            Modifică playlist
          </button>
          <button onClick={handleDeleteAgency}
            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1.5 rounded-lg">
            Șterge
          </button>
        </div>
      </div>

      {/* TV status */}
      <div className="flex flex-wrap gap-2 mb-3">
        {agency.tvs.length === 0 && (
          <span className="text-xs text-gray-400">Niciun TV adăugat.</span>
        )}
        {agency.tvs.map(tv => {
          const { online, label } = tvStatus(tv)
          return (
            <span key={tv.id}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full
                ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {online ? '●' : '○'} {tv.label} — {label}
              {!online && (
                <button onClick={() => handleDeleteTv(tv)}
                  className="ml-1 text-gray-400 hover:text-red-500 leading-none">✕</button>
              )}
            </span>
          )
        })}
        <button onClick={() => setAddingTv(v => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 px-2 py-1 rounded-full">
          + TV
        </button>
      </div>

      {/* Add TV form */}
      {addingTv && (
        <form onSubmit={handleAddTv} className="flex gap-2 mb-3 items-center">
          <input
            value={tvLabel}
            onChange={e => setTvLabel(e.target.value)}
            placeholder='ex: "TV-1" sau "TV-Recepție"'
            className="flex-1 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button type="submit"
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            Adaugă
          </button>
          <button type="button" onClick={() => setAddingTv(false)}
            className="text-xs text-gray-400 hover:text-gray-600">
            Anulează
          </button>
        </form>
      )}
      {tvError && <p className="text-xs text-red-500 mb-2">{tvError}</p>}

      {/* Current playlist */}
      <div className="flex flex-wrap gap-2">
        {agency.playlist?.length === 0 && (
          <span className="text-xs text-gray-400">Niciun conținut asignat.</span>
        )}
        {agency.playlist?.map((item, i) => (
          <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
            {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
          </span>
        ))}
      </div>

      {showModal && (
        <PlaylistModal
          agency={agency}
          current={agency.playlist?.map(p => ({ ...p, id: p.id })) || []}
          onClose={() => setShowModal(false)}
          onSaved={onPlaylistSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `dashboard/src/pages/Agencies.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { getAgencies, getPlaylist, createAgency } from '../api'
import AgencyCard from '../components/AgencyCard'

export default function Agencies() {
  const [agencies, setAgencies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('')
  const [formError, setFormError] = useState('')

  const load = async () => {
    const list = await getAgencies()
    const withPlaylists = await Promise.all(
      list.map(async a => ({ ...a, playlist: await getPlaylist(a.id) }))
    )
    setAgencies(withPlaylists)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!newName.trim() || !newCity.trim()) return setFormError('Completează numele și orașul.')
    try {
      await createAgency(newName.trim(), newCity.trim())
      setNewName('')
      setNewCity('')
      setShowForm(false)
      await load()
    } catch {
      setFormError('Eroare la creare agenție.')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Agenții ({agencies.length})</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Agenție nouă
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-white border border-blue-100 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end shadow-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nume agenție</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='ex: "Agenția Floreasca"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Oraș</label>
            <input value={newCity} onChange={e => setNewCity(e.target.value)}
              placeholder='ex: "București"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-40" />
          </div>
          <button type="submit"
            className="bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-800">
            Creează
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="text-sm text-gray-400 hover:text-gray-600">
            Anulează
          </button>
          {formError && <p className="text-xs text-red-500 w-full">{formError}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agencies.map(agency => (
          <AgencyCard
            key={agency.id}
            agency={agency}
            onPlaylistSaved={load}
            onDeleted={load}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Manual test**

Navigate to `/agencies`. Confirm 10 agency cards. Test:
1. Click "+ Agenție nouă" → fill name + city → Creează → card nou apare
2. Click "+ TV" pe un card → scrie "TV-Recepție" → Adaugă → apare în lista TV-urilor
3. Click "✕" pe un TV offline → confirmare → TV dispare
4. Click "Modifică playlist" → adaugă fișiere → drag reordonare → Salvează → playlist apare pe card
5. Click "Șterge" pe agenția nou creată → confirmare → dispare din listă

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/pages/Agencies.jsx dashboard/src/components/AgencyCard.jsx dashboard/src/components/PlaylistModal.jsx
git commit -m "feat: agencies page with create/delete agency, TV management, playlist editor"
```

---

## Task 10: Dashboard — TVs page

**Files:**
- Create: `dashboard/src/pages/TVs.jsx`

- [ ] **Step 1: Write `dashboard/src/pages/TVs.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { getAgencies } from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return 'Niciodată'
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  if (diff < 60_000) return 'Acum < 1min'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min în urmă`
  return `${Math.round(diff / 3_600_000)}h în urmă`
}

export default function TVs() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    getAgencies().then(agencies => {
      setRows(agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name, city: a.city }))))
    })
    const interval = setInterval(() => {
      getAgencies().then(agencies => {
        setRows(agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name, city: a.city }))))
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const isOnline = (tv) => {
    if (!tv.last_seen_at) return false
    return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">TV-uri ({rows.length})</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {['Status', 'TV', 'Agenție', 'Oraș', 'IP', 'Ultima activitate'].map(h => (
                <th key={h} className="text-left px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(tv => (
              <tr key={tv.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`text-lg ${isOnline(tv) ? 'text-green-500' : 'text-gray-300'}`}>●</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{tv.label}</td>
                <td className="px-4 py-3 text-gray-600">{tv.agency_name}</td>
                <td className="px-4 py-3 text-gray-500">{tv.city}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{tv.ip_address || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{timeAgo(tv.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manual test**

Navigate to `/tvs`. See table with 20 rows. All show "Niciodată" (no Pi connected yet). Confirm auto-refresh every 30s.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/pages/TVs.jsx
git commit -m "feat: TVs status page with auto-refresh"
```

---

## Task 11: Player — setup + WebSocket + playlist

**Files:**
- Create: `player/package.json`
- Create: `player/vite.config.js`
- Create: `player/index.html`
- Create: `player/src/main.jsx`
- Create: `player/src/useWebSocket.js`
- Create: `player/src/usePlaylist.js`

- [ ] **Step 1: Init player project**

```bash
cd /path/to/digital-signage
npm create vite@latest player -- --template react
cd player
npm install
```

- [ ] **Step 2: Write `player/src/useWebSocket.js`**

```js
import { useEffect, useRef, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_WS || 'ws://localhost:4000'
const AGENCY_ID = import.meta.env.VITE_AGENCY_ID || '1'
const TV_ID = import.meta.env.VITE_TV_ID || 'TV-1'
const RECONNECT_MS = 10_000
const PING_MS = 30_000

export function useWebSocket(onMessage) {
  const ws = useRef(null)
  const pingTimer = useRef(null)
  const reconnectTimer = useRef(null)

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    ws.current = new WebSocket(SERVER_URL)

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'register', agencyId: AGENCY_ID, tvId: TV_ID }))
      pingTimer.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_MS)
    }

    ws.current.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch {}
    }

    ws.current.onclose = () => {
      clearInterval(pingTimer.current)
      reconnectTimer.current = setTimeout(connect, RECONNECT_MS)
    }

    ws.current.onerror = () => ws.current?.close()
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      ws.current?.close()
    }
  }, [connect])
}
```

- [ ] **Step 3: Write `player/src/usePlaylist.js`**

```js
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'signage_playlist'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function usePlaylist() {
  const [playlist, setPlaylist] = useState(loadSaved)

  const update = useCallback((items) => {
    setPlaylist(items)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [])

  return { playlist, update }
}
```

- [ ] **Step 4: Commit**

```bash
git add player/
git commit -m "feat: player scaffold, WebSocket hook, playlist persistence"
```

---

## Task 12: Player — media cache + playback UI

**Files:**
- Create: `player/src/useMediaCache.js`
- Create: `player/src/components/VideoPlayer.jsx`
- Create: `player/src/components/ImageDisplay.jsx`
- Create: `player/src/App.jsx`

- [ ] **Step 1: Write `player/src/useMediaCache.js`**

```js
import { useState, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
const DB_NAME = 'signage-cache'
const STORE = 'media'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = reject
  })
}

async function getCached(db, filename) {
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(filename)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

async function putCached(db, filename, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, filename)
    tx.oncomplete = resolve
    tx.onerror = reject
  })
}

export function useMediaCache() {
  const [ready, setReady] = useState(false)
  const [urls, setUrls] = useState({})

  const cachePlaylist = useCallback(async (items) => {
    const db = await openDb()
    const result = {}

    for (const item of items) {
      const cached = await getCached(db, item.filename)
      if (cached) {
        result[item.filename] = URL.createObjectURL(cached)
      } else {
        try {
          const res = await fetch(`${SERVER_URL}/api/media/${item.filename}`)
          const blob = await res.blob()
          await putCached(db, item.filename, blob)
          result[item.filename] = URL.createObjectURL(blob)
        } catch {
          // Offline or fetch failed — item will be skipped
        }
      }
    }

    setUrls(result)
    setReady(true)
  }, [])

  return { urls, ready, cachePlaylist }
}
```

- [ ] **Step 2: Write `player/src/components/VideoPlayer.jsx`**

```jsx
export default function VideoPlayer({ src, onEnded }) {
  return (
    <video
      key={src}
      src={src}
      autoPlay
      muted
      onEnded={onEnded}
      className="w-full h-full object-contain bg-black"
    />
  )
}
```

- [ ] **Step 3: Write `player/src/components/ImageDisplay.jsx`**

```jsx
import { useEffect } from 'react'

const DEFAULT_DURATION = 10_000

export default function ImageDisplay({ src, duration, onEnded }) {
  useEffect(() => {
    const t = setTimeout(onEnded, (duration || DEFAULT_DURATION / 1000) * 1000)
    return () => clearTimeout(t)
  }, [src, duration, onEnded])

  return (
    <img
      key={src}
      src={src}
      alt=""
      className="w-full h-full object-contain bg-black"
    />
  )
}
```

- [ ] **Step 4: Write `player/src/App.jsx`**

```jsx
import { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { usePlaylist } from './usePlaylist'
import { useMediaCache } from './useMediaCache'
import VideoPlayer from './components/VideoPlayer'
import ImageDisplay from './components/ImageDisplay'

export default function App() {
  const { playlist, update } = usePlaylist()
  const { urls, ready, cachePlaylist } = useMediaCache()
  const [index, setIndex] = useState(0)

  const onMessage = useCallback((msg) => {
    if (msg.type === 'playlist_update') {
      update(msg.items)
      cachePlaylist(msg.items)
    }
  }, [update, cachePlaylist])

  useWebSocket(onMessage)

  // Cache on first mount from saved playlist
  useEffect(() => {
    if (playlist.length > 0) cachePlaylist(playlist)
  }, [])

  const next = useCallback(() => {
    setIndex(i => (i + 1) % Math.max(playlist.length, 1))
  }, [playlist.length])

  if (!ready || playlist.length === 0) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <p className="text-white text-opacity-30 text-sm">Conectare...</p>
      </div>
    )
  }

  const current = playlist[index % playlist.length]
  const src = urls[current?.filename]

  if (!src) { next(); return null }

  return (
    <div className="w-screen h-screen bg-black">
      {current.type === 'video' ? (
        <VideoPlayer src={src} onEnded={next} />
      ) : (
        <ImageDisplay src={src} duration={current.display_duration_seconds} onEnded={next} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update `player/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
```

Replace `player/src/index.css` with just:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: black; overflow: hidden; }
```

- [ ] **Step 6: Create `player/.env.example`**

```
VITE_SERVER_URL=https://your-server.com
VITE_SERVER_WS=wss://your-server.com
VITE_AGENCY_ID=1
VITE_TV_ID=TV-1
```

- [ ] **Step 7: End-to-end manual test**

```bash
# Terminal 1 — server
cd server && npm run dev

# Terminal 2 — dashboard
cd dashboard && npm run dev

# Terminal 3 — player (simulating Pi)
cd player && npm run dev
```

1. Open dashboard at `http://localhost:5173`. Upload a video and an image.
2. Go to Agenții. Modify playlist for "Agenția Centrală" (id=1). Add both files. Save.
3. Open player at `http://localhost:5174`. Player connects, receives playlist, downloads files, starts playing.
4. Modify playlist in dashboard again. Confirm player switches to new content within seconds.

- [ ] **Step 8: Commit**

```bash
git add player/src/
git commit -m "feat: player app with media cache and playback loop"
```

---

## Task 13: Raspberry Pi setup scripts

**Files:**
- Create: `setup/signage.service`
- Create: `setup/start-chromium.sh`
- Create: `setup/nginx.conf`
- Create: `setup/README.md`

- [ ] **Step 1: Write `setup/signage.service`**

```ini
[Unit]
Description=Digital Signage Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/signage/player
EnvironmentFile=/etc/signage/config.env
ExecStartPre=/bin/bash -c 'until curl -sf $VITE_SERVER_URL/api/media > /dev/null 2>&1; do sleep 5; done'
ExecStart=/usr/bin/npm run preview -- --port 3000 --host
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Write `setup/start-chromium.sh`**

```bash
#!/bin/bash
# Kiosk launcher — runs after signage.service is up
sleep 5
export DISPLAY=:0
xset s off
xset -dpms
xset s noblank
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --check-for-update-interval=31536000 \
  http://localhost:3000
```

- [ ] **Step 3: Write `setup/nginx.conf` (for the VPS)**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 512M;

    # API + WebSocket
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
    }

    # Admin dashboard (static build)
    location /admin/ {
        alias /home/ubuntu/signage/dashboard/dist/;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

- [ ] **Step 4: Write `setup/README.md`**

```markdown
# Setup Pi

1. Flash Raspberry Pi OS Lite (64-bit) to SD card
2. SSH into Pi and run:

```bash
sudo apt update && sudo apt install -y nodejs npm chromium-browser xorg openbox
sudo mkdir -p /etc/signage
sudo tee /etc/signage/config.env <<EOF
VITE_SERVER_URL=https://your-domain.com
VITE_SERVER_WS=wss://your-domain.com
VITE_AGENCY_ID=3
VITE_TV_ID=TV-1
EOF

cd /home/pi && git clone <repo-url> signage
cd signage/player && npm install && npm run build

sudo cp /home/pi/signage/setup/signage.service /etc/systemd/system/
sudo systemctl enable signage
sudo systemctl start signage
```

3. Add chromium to autostart:
```bash
mkdir -p ~/.config/openbox
echo '/home/pi/signage/setup/start-chromium.sh &' >> ~/.config/openbox/autostart
```

4. Reboot — TV should start playing automatically.
```
```

- [ ] **Step 5: Commit**

```bash
git add setup/
git commit -m "feat: Pi setup scripts, nginx config, systemd service"
```

---

## Self-Review Checklist

After writing the plan, verify:

**Spec coverage:**
- [x] Upload video + image → Task 4
- [x] List/delete media → Task 4
- [x] Per-agency playlist → Task 5
- [x] Create agency → Task 5 (POST /api/agencies) + Task 9 (UI)
- [x] Delete agency (with TVs + playlist cascade) → Task 5 + Task 9
- [x] Add TV to agency → Task 5 (POST /api/agencies/:id/tvs) + Task 9
- [x] Delete TV → Task 5 (DELETE /api/tvs/:tvId) + Task 9
- [x] No fixed limit on TVs per agency → handled by dynamic add/delete
- [x] WebSocket push on playlist change → Task 6 + Task 5 (`pushPlaylist`)
- [x] TV registration + last_seen_at → Task 6
- [x] Heartbeat / ping-pong → Task 6
- [x] Admin login + JWT → Task 3
- [x] Content page (drag & drop upload) → Task 8
- [x] Agencies page + PlaylistModal → Task 9
- [x] TVs status page → Task 10
- [x] Player WebSocket + reconnect → Task 11
- [x] Player offline cache → Task 12
- [x] Video + image playback loop → Task 12
- [x] Pi systemd + kiosk setup → Task 13
- [x] Nginx + HTTPS config → Task 13
- [x] Range headers for video → Task 4
- [x] Seed 10 agencies + 20 TVs → Task 2

**No placeholders found.**

**Type consistency verified:** `pushPlaylist(agencyId, items)` defined in Task 6, called in Task 5. `useWebSocket`, `usePlaylist`, `useMediaCache` all consistent across Tasks 11–12.
