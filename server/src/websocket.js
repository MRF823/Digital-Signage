import { WebSocketServer } from 'ws'
import { getDb } from './db.js'
import { getCurrentRates } from './rates.js'
import { getCurrentForexRates } from './forex.js'
import { shouldScreenBeOn } from './scheduler.js'
import { sendOfflineAlert, sendReconnectedAlert } from './mailer.js'

// tvKey -> { timer, agencyName, tvLabel }
const offlineTimers = new Map()
// tvKeys pentru care alerta offline a fost deja trimisă (așteptăm reconectare)
const confirmedOffline = new Set()

// Map: agencyId (string) -> Set of WebSocket clients
const clients = new Map()

// Map: `${agencyId}:${tvLabel}` -> ws (pentru push per TV)
const tvClients = new Map()

// Set cu TV-urile forex conectate
const forexClients = new Set()

// Map: agencyId (string) -> Set cu TV-urile info obligatorii conectate
const infoClients = new Map()

// Set of update agent connections
const updateAgents = new Set()

export function initWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  // Heartbeat: detectează conexiuni moarte (mini PC scos din priză) în max 60s
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) { ws.terminate(); return }
      ws.isAlive = false
      ws.ping()
    })
  }, 30_000)
  wss.on('close', () => clearInterval(heartbeatInterval))

  wss.on('connection', (ws, req) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

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
        tvClients.set(`${agencyId}:${tvId}`, ws)

        const tvKey = `${agencyId}:${tvId}`
        if (offlineTimers.has(tvKey)) {
          // Reconectat înainte ca alerta să fie trimisă — anulăm silențios
          const { timer } = offlineTimers.get(tvKey)
          clearTimeout(timer)
          offlineTimers.delete(tvKey)
        } else if (confirmedOffline.has(tvKey)) {
          // Reconectat după ce alerta offline a fost trimisă — trimite reconectare
          confirmedOffline.delete(tvKey)
          let agencyName = ''
          try {
            const row = getDb().prepare('SELECT name FROM agencies WHERE id = ?').get(agencyId)
            agencyName = row?.name || `Agency ${agencyId}`
          } catch {}
          sendReconnectedAlert(tvId, agencyName)
        }

        try {
          const db2 = getDb()
          const ip = req.socket.remoteAddress

          // Log uptime connect
          db2.prepare(`INSERT INTO tv_uptime (agency_id, tv_label, connected_at) VALUES (?, ?, datetime('now'))`).run(agencyId, tvId)

          // Auto-asignare mod după label
          const isForexTV = typeof tvId === 'string' && tvId.toLowerCase() === 'tv schimb valutar'
          const isInfoTV = typeof tvId === 'string' && tvId.toLowerCase() === 'tv info obligatorii'
          if (isForexTV) {
            db2.prepare(`UPDATE tvs SET forex_mode = 1, last_seen_at = datetime('now'), ip_address = ? WHERE agency_id = ? AND label = ?`)
              .run(ip, agencyId, tvId)
          } else if (isInfoTV) {
            db2.prepare(`UPDATE tvs SET info_mode = 1, last_seen_at = datetime('now'), ip_address = ? WHERE agency_id = ? AND label = ?`)
              .run(ip, agencyId, tvId)
          } else {
            db2.prepare(`UPDATE tvs SET last_seen_at = datetime('now'), ip_address = ? WHERE agency_id = ? AND label = ?`)
              .run(ip, agencyId, tvId)
          }

          // Verifică modul din DB (label are prioritate față de flag-ul din DB)
          const tvRow = db2.prepare('SELECT forex_mode, info_mode FROM tvs WHERE agency_id = ? AND label = ?').get(agencyId, tvId)
          const isForex = isForexTV || tvRow?.forex_mode === 1
          const isInfo = isInfoTV || tvRow?.info_mode === 1

          if (isInfo) {
            if (!infoClients.has(agencyId)) infoClients.set(agencyId, new Set())
            infoClients.get(agencyId).add(ws)
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'info_mode', enabled: true }))
              const docs = db2.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
              const agencyRow = db2.prepare('SELECT info_rotation_seconds, info_on_time, info_off_time FROM agencies WHERE id = ?').get(agencyId)
              ws.send(JSON.stringify({ type: 'info_docs', docs, rotation_seconds: agencyRow?.info_rotation_seconds ?? 5 }))
              if (!shouldScreenBeOn(agencyRow?.info_on_time, agencyRow?.info_off_time)) {
                ws.send(JSON.stringify({ type: 'info_power', on: false }))
              }
            }
            return
          }

          if (isForex) {
            forexClients.add(ws)
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ type: 'forex_mode', enabled: true }))
              const forexRates = getCurrentForexRates()
              if (forexRates) ws.send(JSON.stringify({ type: 'forex_rates_update', ...forexRates }))
            }
            return
          }

          // TV normal — trimite playlist
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

          const rates = getCurrentRates()
          if (rates && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'rates_update', ...rates }))
          }

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
      forexClients.delete(ws)
      if (agencyId && infoClients.has(agencyId)) {
        infoClients.get(agencyId).delete(ws)
        if (infoClients.get(agencyId).size === 0) infoClients.delete(agencyId)
      }
      if (agencyId && tvId) {
        const tvKey = `${agencyId}:${tvId}`
        tvClients.delete(tvKey)
        // Log uptime disconnect
        try {
          getDb().prepare(`UPDATE tv_uptime SET disconnected_at = datetime('now') WHERE agency_id = ? AND tv_label = ? AND disconnected_at IS NULL`).run(agencyId, tvId)
        } catch {}
        // Pornește timer 2 min pentru alertă offline
        let agencyName = ''
        try {
          const row = getDb().prepare('SELECT name FROM agencies WHERE id = ?').get(agencyId)
          agencyName = row?.name || `Agency ${agencyId}`
        } catch {}
        const timer = setTimeout(() => {
          offlineTimers.delete(tvKey)
          confirmedOffline.add(tvKey)
          sendOfflineAlert(tvId, agencyName)
        }, 2 * 60 * 1000)
        offlineTimers.set(tvKey, { timer, agencyName, tvLabel: tvId })
      }
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

export function pushForexRates(data) {
  const msg = JSON.stringify({ type: 'forex_rates_update', ...data })
  for (const client of forexClients) {
    if (client.readyState === 1) client.send(msg)
  }
}

export function pushForexMode(agencyId, tvLabel, enabled) {
  const key = `${agencyId}:${tvLabel}`
  const ws = tvClients.get(key)
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'forex_mode', enabled }))
    if (enabled) {
      const forexRates = getCurrentForexRates()
      if (forexRates) ws.send(JSON.stringify({ type: 'forex_rates_update', ...forexRates }))
      forexClients.add(ws)
    } else {
      forexClients.delete(ws)
    }
  }
}

export function pushInfoDocs(agencyId, docs, rotationSeconds) {
  const msg = JSON.stringify({ type: 'info_docs', docs, rotation_seconds: rotationSeconds })
  const agencyInfoClients = infoClients.get(String(agencyId))
  if (!agencyInfoClients) return
  for (const client of agencyInfoClients) {
    if (client.readyState === 1) client.send(msg)
  }
}

export function pushInfoPower(agencyId, on) {
  const msg = JSON.stringify({ type: 'info_power', on })
  const agencyInfoClients = infoClients.get(String(agencyId))
  if (!agencyInfoClients) return
  for (const client of agencyInfoClients) {
    if (client.readyState === 1) client.send(msg)
  }
}

export function pushInfoMode(agencyId, tvLabel, enabled) {
  const key = `${agencyId}:${tvLabel}`
  const ws = tvClients.get(key)
  if (!ws || ws.readyState !== 1) return
  ws.send(JSON.stringify({ type: 'info_mode', enabled }))
  if (enabled) {
    try {
      const db = getDb()
      const docs = db.prepare('SELECT * FROM info_docs WHERE agency_id = ? ORDER BY side, position').all(agencyId)
      const agencyRow = db.prepare('SELECT info_rotation_seconds FROM agencies WHERE id = ?').get(agencyId)
      ws.send(JSON.stringify({ type: 'info_docs', docs, rotation_seconds: agencyRow?.info_rotation_seconds ?? 5 }))
      if (!infoClients.has(String(agencyId))) infoClients.set(String(agencyId), new Set())
      infoClients.get(String(agencyId)).add(ws)
    } catch {}
  } else {
    const agencyInfoClients = infoClients.get(String(agencyId))
    if (agencyInfoClients) agencyInfoClients.delete(ws)
  }
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
