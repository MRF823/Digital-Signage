// Agent de actualizare — ruleaza pe mini PC via pm2
// Se conecteaza la VPS si asteapta comanda trigger_update din dashboard

const WebSocket = require('ws')
const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')

const WS_URL = 'ws://92.5.28.167:4000'
const SCRIPT = path.join(__dirname, '..', 'setup', 'windows', 'auto-update.ps1')
const LOG_FILE = path.join(__dirname, '..', 'update.log')

function log(msg) {
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch {}
}

let updating = false

function runUpdate() {
  if (updating) {
    log('Actualizare deja in curs — ignorat')
    return
  }
  updating = true
  log('Incep actualizare din dashboard...')

  execFile(
    'powershell.exe',
    ['-ExecutionPolicy', 'Bypass', '-File', SCRIPT],
    { timeout: 300_000 },
    (err, stdout) => {
      updating = false
      if (err) {
        log('Eroare actualizare: ' + err.message)
      } else {
        log('Actualizare finalizata: ' + (stdout || '').trim().split('\n').pop())
      }
    }
  )
}

function connect() {
  const ws = new WebSocket(WS_URL)

  ws.on('open', () => {
    log('Conectat la VPS')
    ws.send(JSON.stringify({ type: 'register_update_agent' }))
  })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.type === 'trigger_update') {
      log('Primit comanda trigger_update din dashboard')
      runUpdate()
    }
  })

  ws.on('close', () => {
    log('Deconectat — reconectare in 15s')
    setTimeout(connect, 15_000)
  })

  ws.on('error', (err) => {
    log('Eroare WS: ' + err.message)
  })
}

log('Update agent pornit')
connect()
