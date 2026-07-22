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

    // Caută secțiunea "Casa de schimb" din HTML
    const casaIdx = html.toLowerCase().indexOf('casa de schimb')
    const section = casaIdx >= 0 ? html.slice(casaIdx, casaIdx + 8000) : html

    for (const currency of FOREX_CURRENCIES) {
      // Caută rândul cu codul valutei în secțiunea casa de schimb
      const pattern = new RegExp(currency + '[^]*?([\\d]+[.,][\\d]+)[^]*?([\\d]+[.,][\\d]+)', 'i')
      const match = section.match(pattern)
      if (match) {
        const buy = parseFloat(match[1].replace(',', '.'))
        const sell = parseFloat(match[2].replace(',', '.'))
        if (!isNaN(buy) && !isNaN(sell) && buy > 0 && sell > 0) {
          rates[currency] = { buy, sell }
        }
      }
    }

    return Object.keys(rates).length >= 3 ? rates : null
  } catch (err) {
    console.warn('[forex] scrape error:', err.message)
    return null
  }
}

async function updateForexRates() {
  const rates = await scrapeForexRates()
  if (!rates) return

  currentForexRates = { rates, updatedAt: new Date().toISOString() }
  console.log('[forex] actualizat la', new Date().toLocaleTimeString('ro-RO'), '—', Object.keys(rates).join(', '))
  pushForexRates(currentForexRates)
}

export function getCurrentForexRates() {
  return currentForexRates
}

export function initForex() {
  updateForexRates()
  setInterval(updateForexRates, 60_000)
}
