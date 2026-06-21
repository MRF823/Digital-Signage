import { WebSocketServer } from 'ws'
import { getDb } from './db.js'

// Map: agencyId (string) -> Set of WebSocket clients
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
