import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { initDb, getDb } from './db.js'
import { initWebSocket } from './websocket.js'
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
app.use('/api/media', requireAuth, mediaRoutes)
app.use('/api/agencies', requireAuth, agencyRoutes)
app.use('/api/agencies', requireAuth, playlistRoutes)
app.use('/api/tvs', requireAuth, tvsRoutes)
app.use('/api/groups', requireAuth, groupRoutes)
app.use('/api/groups/:id/schedules', requireAuth, scheduleRoutes)
app.use('/api/campaigns', requireAuth, campaignRoutes)

export { app, httpServer }

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`))
}
