import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { initDb } from './db.js'
import { initWebSocket } from './websocket.js'
import mediaRoutes, { serveFile } from './routes/media.js'
import agencyRoutes from './routes/agencies.js'
import playlistRoutes from './routes/playlists.js'
import tvsRoutes from './routes/tvs.js'
import { loginHandler, requireAuth } from './auth.js'
import rateLimit from 'express-rate-limit'

const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 10 })

const app = express()
const httpServer = createServer(app)

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 100 }))

initDb()
initWebSocket(httpServer)

app.post('/api/login', loginRateLimit, loginHandler)
// File serving is public — filenames are random UUIDs, not guessable; needed for <video> elements
app.get('/api/media/:filename', serveFile)
app.use('/api/media', requireAuth, mediaRoutes)
app.use('/api/agencies', requireAuth, agencyRoutes)
app.use('/api/agencies', requireAuth, playlistRoutes)
app.use('/api/tvs', requireAuth, tvsRoutes)

export { app, httpServer }

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`))
}
