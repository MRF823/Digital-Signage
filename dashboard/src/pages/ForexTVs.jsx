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
    <div style={{ background: '#1a2e20', borderRadius: 16, overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>CEC BANK</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: 2, marginTop: 3 }}>CURSURI DE SCHIMB VALUTAR</div>
      </div>
      {/* Antet tabel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {['VALUTĂ','CUMPĂRĂM','VINDEM'].map((h, i) => (
          <span key={h} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textAlign: i === 0 ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>
      {/* Rânduri */}
      {ORDER.map(code => {
        const meta = CURRENCY_META[code]
        const r = rates?.[code]
        const isMain = code === 'EUR' || code === 'USD'
        return (
          <div key={code} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: isMain ? '6px 12px' : '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: isMain ? 18 : 14 }}>{meta.flag}</span>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: isMain ? 14 : 11 }}>{meta.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 8 }}>{code}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 700, color: '#2ecc71', fontSize: isMain ? 15 : 11 }}>
              {r?.buy != null ? r.buy.toFixed(4) : '—'}
            </div>
            <div style={{ textAlign: 'center', fontWeight: 700, color: '#e67e22', fontSize: isMain ? 15 : 11 }}>
              {r?.sell != null ? r.sell.toFixed(4) : '—'}
            </div>
          </div>
        )
      })}
      {/* Footer */}
      <div style={{ padding: '6px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, textAlign: 'center', marginBottom: 4 }}>
          {updatedAt ? `Ultima actualizare: ${formatUpdated(updatedAt)}` : ''}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 7, lineHeight: 1.5, textAlign: 'left' }}>
          Cursurile CEC Bank se pot modifica de mai multe ori pe parcursul unei zile, în funcție de mișcările pieței valutare interbancare.<br />
          În cazul schimburilor valutare inițiate online, de persoane fizice, se aplică cursul valutar mai avantajos, valabil pe Internet și Mobile Banking.
        </div>
      </div>
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
