import express from 'express'
import WebSocket from 'ws'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VPS_HTTP = process.env.VPS_URL || 'http://92.5.28.167:4000'
const VPS_WS   = process.env.VPS_WS  || 'ws://92.5.28.167:4000'
const AGENCY_ID = process.env.AGENCY_ID || '13'
const TV_ID     = process.env.TV_ID     || 'TV-1'
const PORT      = process.env.PORT      || 4001
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media')

fs.mkdirSync(MEDIA_DIR, { recursive: true })

// --- HTTP server: serveste media din disc local ---
const app = express()

app.get('/api/media/:filename', (req, res) => {
  const file = path.join(MEDIA_DIR, req.params.filename)
  if (fs.existsSync(file)) {
    res.sendFile(file)
  } else {
    res.status(404).json({ error: 'not found' })
  }
})

app.get('/health', (req, res) => {
  const files = fs.readdirSync(MEDIA_DIR).length
  res.json({ ok: true, files, mediaDir: MEDIA_DIR })
})

app.listen(PORT, () => {
  console.log(`[media-sync] Server local pornit pe http://localhost:${PORT}`)
  console.log(`[media-sync] Media salvata in: ${MEDIA_DIR}`)
})

// --- Download media de pe VPS ---
async function downloadFile(filename) {
  const dest = path.join(MEDIA_DIR, filename)
  if (fs.existsSync(dest)) {
    console.log(`[media-sync] Deja exista: ${filename}`)
    return
  }

  console.log(`[media-sync] Descarc: ${filename}`)
  try {
    const res = await fetch(`${VPS_HTTP}/api/media/${filename}`)
    if (!res.ok) {
      console.error(`[media-sync] Eroare HTTP ${res.status} pentru ${filename}`)
      return
    }
    const buffer = await res.arrayBuffer()
    fs.writeFileSync(dest, Buffer.from(buffer))
    console.log(`[media-sync] Salvat: ${filename} (${Math.round(buffer.byteLength / 1024)} KB)`)
  } catch (err) {
    console.error(`[media-sync] Download esuat pentru ${filename}:`, err.message)
  }
}

async function syncPlaylist(items) {
  console.log(`[media-sync] Sync playlist: ${items.length} items`)
  for (const item of items) {
    await downloadFile(item.filename)
  }
  console.log('[media-sync] Sync complet.')
}

// --- WebSocket catre VPS pentru playlist updates ---
let reconnectTimer = null

function connect() {
  console.log(`[media-sync] Conectare la VPS: ${VPS_WS}`)
  const ws = new WebSocket(VPS_WS)

  ws.on('open', () => {
    console.log('[media-sync] Conectat la VPS.')
    ws.send(JSON.stringify({ type: 'register', agencyId: AGENCY_ID, tvId: TV_ID }))
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data)
      if (msg.type === 'playlist_update') {
        syncPlaylist(msg.items)
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log('[media-sync] Deconectat de la VPS. Reconectare in 15 sec...')
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 15_000)
  })

  ws.on('error', (err) => {
    console.error('[media-sync] WS eroare:', err.message)
    ws.close()
  })
}

connect()
