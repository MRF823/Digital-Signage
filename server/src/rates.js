import { pushRatesToAll } from './websocket.js'

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

let currentRates = null
let lastRatesJson = ''

async function scrapeCEC() {
  try {
    const res = await fetch('https://www.cursbnr.ro/curs-valutar-banci', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10_000),
    })
    const html = await res.text()
    const rates = {}

    // Pagina are tabele separate per valuta — fiecare contine header-ul valutei si randuri per banca
    const tables = html.split('<table')
    for (const table of tables) {
      for (const currency of CURRENCIES) {
        if (rates[currency]) continue
        if (!table.includes(currency) || !table.includes('Banca cumpara')) continue
        if (!table.includes('CEC BANK')) continue

        const cecIdx = table.indexOf('CEC BANK')
        const section = table.slice(cecIdx, cecIdx + 400)
        const nums = section.match(/(\d+\.\d+)/g)
        if (nums && nums.length >= 2) {
          rates[currency] = {
            buy: parseFloat(nums[0]),
            sell: parseFloat(nums[1]),
          }
        }
      }
    }

    return Object.keys(rates).length >= 1 ? rates : null
  } catch (err) {
    console.warn('CEC scrape error:', err.message)
    return null
  }
}

async function fetchBNR() {
  try {
    const res = await fetch('https://www.bnr.ro/nbrfxrates.xml', {
      signal: AbortSignal.timeout(10_000),
    })
    const xml = await res.text()
    const rates = {}

    for (const currency of CURRENCIES) {
      const match = xml.match(new RegExp(`<Rate currency="${currency}">([\\.\\d]+)<`))
      if (match) rates[currency] = parseFloat(match[1])
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
