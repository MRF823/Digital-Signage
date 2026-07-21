import { WebSocketServer } from 'ws'
import { getDb } from './db.js'
import { getCurrentRates } from './rates.js'
import { shouldScreenBeOn } from './scheduler.js'

// Map: agencyId (string) -> Set of WebSocket clients
const clients = new Map()

// Set of update agent connections
const updateAgents = new Set()

export function initWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    let agencyId = null
    let tvId = null

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'register_update_agent') {
        updateAgents.add(ws)
        return
      }

      if (msg.type === 'register') {
        agencyId = String(msg.agencyId)
        tvId = msg.tvId

        if (!clients.has(agencyId)) clients.set(agencyId, new Set())
        clients.get(agencyId).add(ws)

        try {
          // Update TV last_seen_at and ip_address
          const ip = req.socket.remoteAddress
          getDb().prepare(`
            UPDATE tvs SET last_seen_at = datetime('now'), ip_address = ?
            WHERE agency_id = ? AND label = ?
          `).run(ip, agencyId, tvId)

          // Send current playlist immediately on connect
          const db2 = getDb()
          const playlist = db2.prepare(`
            SELECT pi.*, m.filename, m.original_name, m.type, m.duration_seconds
            FROM playlist_items pi
            JOIN media m ON m.id = pi.media_id
            WHERE pi.agency_id = ?
            ORDER BY pi.position
          `).all(agencyId)

          const groupRow = db2.prepare(`
            SELECT g.transition FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.agency_id = ? LIMIT 1
          `).get(agencyId)
          const transition = groupRow?.transition || 'fade'

          const agencyRow = db2.prepare('SELECT name, show_agency_name, show_player_label FROM agencies WHERE id = ?').get(agencyId)
          const agencyName = agencyRow?.name || ''
          const showAgencyName = agencyRow?.show_agency_name !== 0
          const showPlayerLabel = agencyRow?.show_player_label === 1

          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'playlist_update', items: playlist, transition, agencyName, showAgencyName, showPlayerLabel }))
          }

          // Trimite cursul valutar curent imediat la conectare
          const rates = getCurrentRates()
          if (rates && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'rates_update', ...rates }))
          }

          // Dacă ecranul ar trebui să fie off, trimite comanda la conectare
          const powerRow = db2.prepare(`
            SELECT g.power_on_time, g.power_off_time FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.agency_id = ? LIMIT 1
          `).get(agencyId)
          if (!shouldScreenBeOn(powerRow?.power_on_time, powerRow?.power_off_time)) {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'screen_power', on: false }))
          }
        } catch {}
      }

      if (msg.type === 'play_log' && agencyId && tvId) {
        try {
          getDb().prepare(`
            INSERT INTO play_log (agency_id, tv_label, filename, original_name, media_type, played_at, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(agencyId, tvId, msg.filename, msg.original_name, msg.media_type, msg.played_at, msg.duration_seconds ?? null)
        } catch {}

        // Sync: broadcast advance to all OTHER TVs in same agency
        const syncMsg = JSON.stringify({ type: 'sync_advance' })
        const agencyClients = clients.get(agencyId)
        if (agencyClients) {
          for (const client of agencyClients) {
            if (client !== ws && client.readyState === 1) client.send(syncMsg)
          }
        }
      }

      if (msg.type === 'ping') {
        if (agencyId && tvId) {
          try {
            getDb().prepare(`UPDATE tvs SET last_seen_at = datetime('now') WHERE agency_id = ? AND label = ?`)
              .run(agencyId, tvId)
          } catch {}
        }
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'pong' }))
        }
      }
    })

    ws.on('close', () => {
      updateAgents.delete(ws)
      if (agencyId && clients.has(agencyId)) {
        clients.get(agencyId).delete(ws)
        if (clients.get(agencyId).size === 0) clients.delete(agencyId)
      }
    })
  })
}

export function pushRatesToAll(data) {
  const msg = JSON.stringify({ type: 'rates_update', ...data })
  for (const agencyClients of clients.values()) {
    for (const client of agencyClients) {
      if (client.readyState === 1) client.send(msg)
    }
  }
}

export function pushScreenPower(agencyId, on) {
  const msg = JSON.stringify({ type: 'screen_power', on })
  const agencyClients = clients.get(String(agencyId))
  if (!agencyClients) return
  for (const client of agencyClients) {
    if (client.readyState === 1) client.send(msg)
  }
}

export function pushReloadToAll() {
  const msg = JSON.stringify({ type: 'reload' })
  for (const agencyClients of clients.values()) {
    for (const client of agencyClients) {
      if (client.readyState === 1) client.send(msg)
    }
  }
}

export function pushSyncMediaToAll() {
  const msg = JSON.stringify({ type: 'sync_media' })
  for (const agencyClients of clients.values()) {
    for (const client of agencyClients) {
      if (client.readyState === 1) client.send(msg)
    }
  }
}

export function pushTriggerUpdate() {
  const msg = JSON.stringify({ type: 'trigger_update' })
  for (const agent of updateAgents) {
    if (agent.readyState === 1) agent.send(msg)
  }
  return updateAgents.size
}

export function pushPlaylist(agencyId, items, transition = 'fade') {
  let agencyName = '', showAgencyName = true, showPlayerLabel = false
  try {
    const row = getDb().prepare('SELECT name, show_agency_name, show_player_label FROM agencies WHERE id = ?').get(agencyId)
    agencyName = row?.name || ''
    showAgencyName = row?.show_agency_name !== 0
    showPlayerLabel = row?.show_player_label === 1
  } catch {}
  const msg = JSON.stringify({ type: 'playlist_update', items, transition, agencyName, showAgencyName, showPlayerLabel })
  const agencyClients = clients.get(String(agencyId))
  if (!agencyClients) return
  for (const client of agencyClients) {
    if (client.readyState === 1) client.send(msg)
  }
}
