import express from 'express'
import WebSocket from 'ws'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VPS_HTTP  = process.env.VPS_URL    || 'http://92.5.28.167:4000'
const VPS_WS    = process.env.VPS_WS     || 'ws://92.5.28.167:4000'
const AGENCY_ID = process.env.AGENCY_ID  || '13'
const TV_ID     = process.env.TV_ID      || 'TV-1'
const PORT      = process.env.PORT       || 4001
const MEDIA_DIR = process.env.MEDIA_DIR  || path.join(__dirname, 'media')

// Pre-download media pentru campaniile care incep in urmatoarele 3 zile
async function prefetchUpcoming() {
  console.log('[media-sync] Verific campanii viitoare (urmatoarele 3 zile)...')
  try {
    const res = await fetch(`${VPS_HTTP}/api/upcoming-media?agencyId=${AGENCY_ID}&days=3`)
    if (!res.ok) return
    const items = await res.json()
    if (items.length === 0) {
      console.log('[media-sync] Nicio campanie viitoare.')
      return
    }
    console.log(`[media-sync] ${items.length} fisiere de pre-descarcat pentru campanii viitoare.`)
    for (const item of items) {
      await downloadFile(item.filename)
    }
    console.log('[media-sync] Pre-download complet.')
  } catch (err) {
    console.error('[media-sync] Pre-fetch eroare:', err.message)
  }
}

// Sync automat la miezul noptii
function scheduleMidnightSync() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const msUntilMidnight = midnight - now
  console.log(`[media-sync] Urmator sync automat la miezul noptii (in ${Math.round(msUntilMidnight / 3600000)}h)`)
  setTimeout(() => {
    console.log('[media-sync] Sync automat miez de noapte — reconectare...')
    ws?.close()
    prefetchUpcoming()
    setInterval(() => {
      console.log('[media-sync] Sync automat zilnic — reconectare...')
      ws?.close()
      prefetchUpcoming()
    }, 24 * 60 * 60 * 1000)
  }, msUntilMidnight)
}

fs.mkdirSync(MEDIA_DIR, { recursive: true })

// --- HTTP: serveste media din disc local ---
const app = express()

app.get('/api/media/:filename', (req, res) => {
  const file = path.join(MEDIA_DIR, req.params.filename)
  if (fs.existsSync(file)) {
    res.sendFile(file)
  } else {
    res.status(404).json({ error: 'not found' })
  }
})

app.get('/health', (_req, res) => {
  const files = fs.readdirSync(MEDIA_DIR)
  res.json({ ok: true, files: files.length, mediaDir: MEDIA_DIR })
})

app.listen(PORT, () => {
  console.log(`[media-sync] Server local pornit pe http://localhost:${PORT}`)
  console.log(`[media-sync] Media salvata in: ${MEDIA_DIR}`)
})

// --- Download cu verificare dimensiune ---
async function downloadFile(filename) {
  const dest = path.join(MEDIA_DIR, filename)

  if (fs.existsSync(dest)) {
    // Verifica daca fisierul de pe server e diferit (comparare dimensiune)
    try {
      const headRes = await fetch(`${VPS_HTTP}/api/media/${filename}`, { method: 'HEAD' })
      const remoteSize = parseInt(headRes.headers.get('content-length') || '0')
      const localSize  = fs.statSync(dest).size

      if (remoteSize > 0 && remoteSize === localSize) {
        console.log(`[media-sync] OK (identic): ${filename}`)
        return
      }

      console.log(`[media-sync] Diferit → redescarc: ${filename} (local: ${localSize}B, server: ${remoteSize}B)`)
      fs.unlinkSync(dest)
    } catch {
      console.log(`[media-sync] Nu pot verifica ${filename}, pastrez ce am.`)
      return
    }
  } else {
    console.log(`[media-sync] Nou → descarc: ${filename}`)
  }

  try {
    const res = await fetch(`${VPS_HTTP}/api/media/${filename}`)
    if (!res.ok) {
      console.error(`[media-sync] HTTP ${res.status} la download ${filename}`)
      return
    }
    const buffer = await res.arrayBuffer()
    fs.writeFileSync(dest, Buffer.from(buffer))
    console.log(`[media-sync] Salvat: ${filename} (${Math.round(buffer.byteLength / 1024)} KB)`)
  } catch (err) {
    console.error(`[media-sync] Download esuat ${filename}:`, err.message)
  }
}

async function syncPlaylist(items) {
  console.log(`[media-sync] Sync playlist: ${items.length} fisiere`)
  for (const item of items) {
    await downloadFile(item.filename)
  }

  // Logheaza fisierele locale care nu mai sunt in playlist (fara sa le stearga)
  const playlistFiles = new Set(items.map(i => i.filename))
  const localFiles    = fs.readdirSync(MEDIA_DIR)
  const orphans       = localFiles.filter(f => !playlistFiles.has(f))
  if (orphans.length > 0) {
    console.log(`[media-sync] Fisiere vechi pe disc (nu mai sunt in playlist): ${orphans.join(', ')}`)
  }

  console.log('[media-sync] Sync complet.')
}

// --- WebSocket catre VPS ---
let ws = null
let reconnectTimer = null

function connect() {
  console.log(`[media-sync] Conectare la VPS: ${VPS_WS}`)
  ws = new WebSocket(VPS_WS)

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
      if (msg.type === 'sync_media') {
        console.log('[media-sync] Comanda sync_media primita din dashboard — reconectare pentru sync...')
        ws.close()
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log('[media-sync] Deconectat. Reconectare in 15 sec...')
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 15_000)
  })

  ws.on('error', (err) => {
    console.error('[media-sync] WS eroare:', err.message)
    ws.close()
  })
}

connect()
scheduleMidnightSync()
// Pre-descarca campanii viitoare si la pornire
setTimeout(prefetchUpcoming, 10_000)
