import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { initDb, getDb } from './db.js'
import { initWebSocket, pushReloadToAll, pushSyncMediaToAll } from './websocket.js'
import mediaRoutes, { serveFile } from './routes/media.js'
import agencyRoutes from './routes/agencies.js'
import playlistRoutes from './routes/playlists.js'
import tvsRoutes from './routes/tvs.js'
import groupRoutes from './routes/groups.js'
import scheduleRoutes from './routes/schedules.js'
import campaignRoutes from './routes/campaigns.js'
import { loginHandler, requireAuth } from './auth.js'
import rateLimit from 'express-rate-limit'
import { initScheduler } from './scheduler.js'
import { initRates, getCurrentRates } from './rates.js'

const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 })

const app = express()
const httpServer = createServer(app)

app.use(cors({ origin: true }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 100 }))

initDb()
initWebSocket(httpServer)
initScheduler()
initRates()

app.post('/api/login', loginRateLimit, loginHandler)
app.get('/api/rates', (req, res) => res.json(getCurrentRates() || {}))
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const db = getDb()
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19)
    const { count } = db.prepare('SELECT COUNT(*) as count FROM play_log WHERE played_at >= ?').get(since)
    res.json({ plays_24h: count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/play-log', requireAuth, (req, res) => {
  const { agency_id, from, to, limit = 200 } = req.query
  let sql = 'SELECT * FROM play_log WHERE 1=1'
  const params = []
  if (agency_id) { sql += ' AND agency_id = ?'; params.push(agency_id) }
  if (from)      { sql += ' AND played_at >= ?'; params.push(from) }
  if (to)        { sql += ' AND played_at <= ?'; params.push(to) }
  sql += ' ORDER BY played_at DESC LIMIT ?'
  params.push(Number(limit))
  try {
    res.json(getDb().prepare(sql).all(...params))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
// File serving is public — filenames are random UUIDs, not guessable; needed for <video> elements
app.get('/api/media/:filename', serveFile)

// Upcoming campaign media — public, returnează filenames pentru campaniile care incep in urmatoarele `days` zile
app.get('/api/upcoming-media', (req, res) => {
  try {
    const db = getDb()
    const agencyId = req.query.agencyId
    const days = parseInt(req.query.days || '3', 10)
    if (!agencyId) return res.status(400).json({ error: 'agencyId required' })

    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)

    const campaigns = db.prepare(`
      SELECT id FROM campaigns
      WHERE agency_id = ? AND start_date > ? AND start_date <= ?
    `).all(agencyId, today, future)

    const files = []
    for (const c of campaigns) {
      const items = db.prepare(`
        SELECT m.filename, m.original_name, m.type, m.duration_seconds
        FROM campaign_items ci JOIN media m ON m.id = ci.media_id
        WHERE ci.campaign_id = ?
      `).all(c.id)
      files.push(...items)
    }

    res.json(files)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
app.use('/api/media', requireAuth, mediaRoutes)
app.use('/api/agencies', requireAuth, agencyRoutes)
app.use('/api/agencies', requireAuth, playlistRoutes)
app.use('/api/tvs', requireAuth, tvsRoutes)
app.use('/api/groups', requireAuth, groupRoutes)
app.use('/api/groups/:id/schedules', requireAuth, scheduleRoutes)
app.use('/api/campaigns', requireAuth, campaignRoutes)
app.post('/api/players/reload', requireAuth, (req, res) => {
  pushReloadToAll()
  res.json({ ok: true })
})

app.post('/api/players/sync-media', requireAuth, (req, res) => {
  pushSyncMediaToAll()
  res.json({ ok: true })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


const dashDist = join(__dirname, '../../dashboard/dist')
if (existsSync(dashDist)) {
  app.use(express.static(dashDist))
  app.use((req, res) => res.sendFile(join(dashDist, 'index.html')))
}

export { app, httpServer }

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`))
}
