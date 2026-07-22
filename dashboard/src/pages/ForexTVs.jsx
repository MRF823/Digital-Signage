import { useEffect, useState } from 'react'
import { getAgencies, getForexTVs, setForexMode, getForexRates } from '../api'

const CURRENCY_META = {
  EUR: { name: 'Euro', flag: '🇪🇺' },
  USD: { name: 'Dolar SUA', flag: '🇺🇸' },
  GBP: { name: 'Liră sterlină', flag: '🇬🇧' },
  CAD: { name: 'Dolar canadian', flag: '🇨🇦' },
  CHF: { name: 'Franc elvețian', flag: '🇨🇭' },
  DKK: { name: 'Coroană daneză', flag: '🇩🇰' },
  HUF: { name: 'Forint maghiar', flag: '🇭🇺' },
  PLN: { name: 'Zlot polonez', flag: '🇵🇱' },
  SEK: { name: 'Coroană suedeză', flag: '🇸🇪' },
}
const ORDER = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'DKK', 'HUF', 'PLN', 'SEK']
const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

function formatUpdated(iso) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} ▪ ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function ForexRatesPanel({ rates, updatedAt }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700">Cursuri de schimb valutar</p>
        {updatedAt && (
          <p className="text-xs text-slate-700 mt-1">
            Ultima actualizare: {formatUpdated(updatedAt)}
          </p>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valută</th>
            <th className="text-center px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cumpărăm</th>
            <th className="text-center px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vindem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {ORDER.map(code => {
            const meta = CURRENCY_META[code]
            const r = rates?.[code]
            const isMain = code === 'EUR' || code === 'USD'
            return (
              <tr key={code} className={isMain ? 'bg-slate-50/60' : ''}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.flag}</span>
                    <div>
                      <p className={`font-medium text-slate-800 ${isMain ? 'text-sm' : 'text-xs'}`}>{meta.name}</p>
                      <p className="text-xs text-slate-400">{code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-green-600">
                  {r?.buy != null ? r.buy.toFixed(4) : '—'}
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-orange-500">
                  {r?.sell != null ? r.sell.toFixed(4) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rates && (
        <div className="px-4 py-6 text-center text-slate-400 text-sm">Cursurile nu sunt disponibile momentan</div>
      )}
    </div>
  )
}

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen + 'Z').getTime()) < 2 * 60 * 1000
}

export default function ForexTVs() {
  const [agencies, setAgencies] = useState([])
  const [forexTvs, setForexTvs] = useState([])
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(null)

  useEffect(() => {
    Promise.all([getAgencies(), getForexTVs(), getForexRates()])
      .then(([agenciesData, tvsData, ratesData]) => {
        setAgencies(agenciesData)
        setForexTvs(tvsData.filter(t => t.label.toLowerCase() === 'tv schimb valutar'))
        setRates(ratesData)
      })
      .finally(() => setLoading(false))
  }, [])

  async function activate(tv) {
    setActivating(tv.id)
    try {
      await setForexMode(tv.id, 1)
    } finally {
      setActivating(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500">Se încarcă...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Schimb Valutar</h1>
        <p className="text-slate-500 text-sm mt-1">TV-uri de schimb valutar din agenții</p>
      </div>

      {rates?.updatedAt && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-700 font-medium">
            Cursuri CEC actualizate la {new Date(rates.updatedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {rates.rates?.EUR && (
            <span className="text-sm text-green-600 ml-2">
              EUR {rates.rates.EUR.buy?.toFixed(4)} / {rates.rates.EUR.sell?.toFixed(4)}
            </span>
          )}
        </div>
      )}

      {!rates?.updatedAt && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-sm text-amber-700">Cursurile forex nu sunt disponibile momentan</span>
        </div>
      )}

      <div className="flex gap-6 items-start">

        {/* Stânga — lista agenții */}
        <div className="flex-1 space-y-3">
          {agencies.map(agency => {
            const tv = forexTvs.find(t => t.agency_id === agency.id)
            const online = tv ? isOnline(tv.last_seen_at) : false

            return (
              <div key={agency.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tv ? (online ? 'bg-green-500' : 'bg-slate-300') : 'bg-slate-200'}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{agency.name}</p>
                    <p className="text-xs text-slate-400">
                      {tv
                        ? online ? 'Online' : tv.last_seen_at ? `Ultima dată: ${new Date(tv.last_seen_at + 'Z').toLocaleString('ro-RO')}` : 'Niciodată conectat'
                        : 'Niciun TV schimb valutar'}
                    </p>
                  </div>
                </div>
                {tv && (
                  <button
                    onClick={() => activate(tv)}
                    disabled={activating === tv.id || !online}
                    className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {activating === tv.id ? 'Se trimite...' : 'Activează forex'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Dreapta — cursuri live */}
        <div className="w-80 flex-shrink-0">
          <ForexRatesPanel rates={rates?.rates} updatedAt={rates?.updatedAt} />
        </div>

      </div>
    </div>
  )
}
