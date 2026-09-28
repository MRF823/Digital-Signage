// Agent de actualizare — ruleaza pe mini PC via pm2
// Se conecteaza la VPS si asteapta comanda trigger_update din dashboard

const WebSocket = require('ws')
const { execFile, exec } = require('child_process')
const path = require('path')
const fs = require('fs')

const WS_URL = 'ws://92.5.28.167:4000'
const SCRIPT = path.join(__dirname, '..', 'setup', 'windows', 'auto-update.ps1')
const LOG_FILE = path.join(__dirname, '..', 'update.log')
const CONFIG_FILE = path.join(__dirname, '..', 'agent-config.json')

// Citeste agencyId din agent-config.json (git-ignored, specific per mini PC)
let agencyId = null
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  agencyId = String(cfg.agencyId)
} catch {}

function log(msg) {
  const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch {}
}

function cmd(command) {
  return new Promise(resolve => {
    exec(command, { timeout: 10_000 }, (err, stdout) => resolve(err ? '' : stdout.trim()))
  })
}

async function collectDiagnostics() {
  const diag = { ts: new Date().toISOString() }

  // CPU
  try {
    const out = await cmd('wmic cpu get LoadPercentage /value')
    const m = out.match(/LoadPercentage=(\d+)/)
    diag.cpu = m ? parseInt(m[1]) : null
  } catch { diag.cpu = null }

  // RAM
  try {
    const out = await cmd('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value')
    const free = out.match(/FreePhysicalMemory=(\d+)/)
    const total = out.match(/TotalVisibleMemorySize=(\d+)/)
    diag.ramFreeGB = free ? +(parseInt(free[1]) / 1024 / 1024).toFixed(1) : null
    diag.ramTotalGB = total ? +(parseInt(total[1]) / 1024 / 1024).toFixed(1) : null
  } catch { diag.ramFreeGB = null; diag.ramTotalGB = null }

  // WiFi
  try {
    const out = await cmd('netsh wlan show interfaces')
    const ssid = out.match(/SSID\s*:\s(.+)/)
    const signal = out.match(/Signal\s*:\s*(\d+)%/)
    diag.wifiSsid = ssid ? ssid[1].trim() : null
    diag.wifiSignal = signal ? parseInt(signal[1]) : null
  } catch { diag.wifiSsid = null; diag.wifiSignal = null }

  // Edge process
  try {
    const out = await cmd('tasklist /fi "imagename eq msedge.exe" /fo csv /nh')
    diag.edgeRunning = out.includes('msedge.exe')
  } catch { diag.edgeRunning = null }

  // Uptime
  try {
    const out = await cmd('wmic OS get LastBootUpTime /value')
    const m = out.match(/LastBootUpTime=(\d{14})/)
    if (m) {
      const b = m[1]
      const boot = new Date(`${b.slice(0,4)}-${b.slice(4,6)}-${b.slice(6,8)}T${b.slice(8,10)}:${b.slice(10,12)}:${b.slice(12,14)}`)
      diag.uptimeSeconds = Math.floor((Date.now() - boot.getTime()) / 1000)
    } else { diag.uptimeSeconds = null }
  } catch { diag.uptimeSeconds = null }

  return diag
}

let updating = false
let activeWs = null

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

async function sendDiagnostics() {
  if (!activeWs || activeWs.readyState !== WebSocket.OPEN || !agencyId) return
  const data = await collectDiagnostics()
  activeWs.send(JSON.stringify({ type: 'agent_diagnostics', agencyId, data }))
}

function connect() {
  const ws = new WebSocket(WS_URL)
  activeWs = ws

  ws.on('open', () => {
    log('Conectat la VPS')
    ws.send(JSON.stringify({ type: 'register_update_agent' }))
    // Trimite diagnostice imediat la conectare, apoi la fiecare 5 minute
    sendDiagnostics()
  })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.type === 'trigger_update') {
      log('Primit comanda trigger_update din dashboard')
      runUpdate()
    }
    if (msg.type === 'request_diagnostics') {
      sendDiagnostics()
    }
  })

  ws.on('close', () => {
    activeWs = null
    log('Deconectat — reconectare in 15s')
    setTimeout(connect, 15_000)
  })

  ws.on('error', (err) => {
    log('Eroare WS: ' + err.message)
  })
}

// Trimite diagnostice la fiecare 5 minute
setInterval(sendDiagnostics, 5 * 60 * 1000)

log(`Update agent pornit (agencyId=${agencyId || 'neconfigurat'})`)
connect()
