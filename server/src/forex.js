import { pushForexRates } from './websocket.js'

const FOREX_CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'DKK', 'HUF', 'PLN', 'SEK']

let currentForexRates = null

async function scrapeForexRates() {
  try {
    const res = await fetch('https://www.cec.ro/curs-valutar', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })
    const html = await res.text()
    const rates = {}

    // Caută secțiunea "Casa de schimb" după id-ul exact din HTML
    const casaIdx = html.indexOf('id="exchangeHouse"')
    if (casaIdx < 0) { console.warn('[forex] exchangeHouse section not found'); return null }
    const section = html.slice(casaIdx, casaIdx + 8000)

    // Structura rând: VALUTA Denumire BNR BCE Cumpărare Vânzare ...
    // Extragem al 3-lea și al 4-lea număr (Cumpărare și Vânzare), sărind BNR și BCE
    for (const currency of FOREX_CURRENCIES) {
      const pattern = new RegExp(currency + '[^\\d]*([\\d]+[.,][\\d]+)[^\\d]+([\\d]+[.,][\\d]+)[^\\d]+([\\d]+[.,][\\d]+)[^\\d]+([\\d]+[.,][\\d]+)', 'i')
      const match = section.match(pattern)
      if (match) {
        const buy = parseFloat(match[3].replace(',', '.'))
        const sell = parseFloat(match[4].replace(',', '.'))
        if (!isNaN(buy) && !isNaN(sell) && buy > 0 && sell > 0) {
          rates[currency] = { buy, sell }
        }
      }
    }

    if (Object.keys(rates).length < 3) return null

    // Extragem timestamp-ul publicat de CEC (ex: "26.08.2026 17:00") — stocăm ca string brut, fără conversie UTC
    const tsMatch = section.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/)
    const cecUpdatedAt = tsMatch ? `${tsMatch[1]} ${tsMatch[2]}` : null

    return { rates, cecUpdatedAt }
  } catch (err) {
    console.warn('[forex] scrape error:', err.message)
    return null
  }
}

async function updateForexRates() {
  const result = await scrapeForexRates()
  if (!result) return

  const { rates, cecUpdatedAt } = result
  const ratesChanged = !currentForexRates || JSON.stringify(rates) !== JSON.stringify(currentForexRates.rates)
  const timestampChanged = cecUpdatedAt && cecUpdatedAt !== currentForexRates?.updatedAt

  if (!ratesChanged && !timestampChanged) return

  const updatedAt = cecUpdatedAt || currentForexRates?.updatedAt || new Date().toISOString()
  currentForexRates = { rates, updatedAt }

  if (ratesChanged) {
    console.log('[forex] curs modificat —', new Date().toLocaleTimeString('ro-RO'), '— CEC timestamp:', cecUpdatedAt)
  } else {
    console.log('[forex] timestamp actualizat:', cecUpdatedAt)
  }
  pushForexRates(currentForexRates)
}

export function getCurrentForexRates() {
  return currentForexRates
}

export function initForex() {
  updateForexRates()
  setInterval(updateForexRates, 60_000)
}
