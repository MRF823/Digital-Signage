import { pushRatesToAll } from './websocket.js'

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

let currentRates = null
let lastRatesJson = ''

async function scrapeCEC() {
  try {
    const res = await fetch('https://www.cec.ro/curs-valutar', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(15_000),
    })
    const html = await res.text()

    // Pagina are 3 tabele cu Cumpărare: Internet Banking, Cont/Card, Casa de Schimb (ultimul, doar EUR/USD/GBP/CHF)
    const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
    const exchangeTables = tableMatches.filter(m => m[0].includes('Cump'))
    // Casa de Schimb e ultimul tabel — cel mai mic, doar 4 valute
    const casaTable = exchangeTables[exchangeTables.length - 1]?.[0]
    if (!casaTable) return null

    const rates = {}
    const rowPattern = /<tr>[\s\S]*?<\/tr>/gi
    for (const rowMatch of casaTable.matchAll(rowPattern)) {
      const tds = [...rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      if (tds.length < 6) continue
      const code = tds[0].replace('*', '')
      if (!CURRENCIES.includes(code)) continue
      const buy = parseFloat(tds[4])
      const sell = parseFloat(tds[5])
      if (!isNaN(buy) && !isNaN(sell)) rates[code] = { buy, sell }
    }

    return Object.keys(rates).length >= 1 ? rates : null
  } catch (err) {
    console.warn('CEC scrape error:', err.message)
    return null
  }
}

async function fetchBNR() {
  try {
    const body = `limit=1&valute=${CURRENCIES.join(',')}`
    const res = await fetch('https://www.bnr.ro/seriizilnice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.bnr.ro/Cursul-de-schimb-3544.aspx',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json()
    if (json.error !== 0 || !json.data) return null

    const dayData = Object.values(json.data)[0] // { EUR: { valuta: '5.25' }, ... }
    const rates = {}
    for (const currency of CURRENCIES) {
      const val = parseFloat(dayData?.[currency]?.valuta)
      if (!isNaN(val)) rates[currency] = val
    }
    return Object.keys(rates).length >= 2 ? rates : null
  } catch (err) {
    console.warn('BNR fetch error:', err.message)
    return null
  }
}

async function updateRates() {
  const [cec, bnr] = await Promise.all([scrapeCEC(), fetchBNR()])
  if (!cec && !bnr) return

  const rates = {}
  for (const currency of CURRENCIES) {
    rates[currency] = {
      buy: cec?.[currency]?.buy ?? null,
      sell: cec?.[currency]?.sell ?? null,
      reference: bnr?.[currency] ?? null,
    }
  }

  const json = JSON.stringify(rates)
  if (json === lastRatesJson) return

  lastRatesJson = json
  currentRates = { rates, updatedAt: new Date().toISOString() }
  console.log('[rates] actualizat la', new Date().toLocaleTimeString('ro-RO'))
  pushRatesToAll(currentRates)
}

export function getCurrentRates() {
  return currentRates
}

export function initRates() {
  updateRates()
  setInterval(updateRates, 15_000)
}
