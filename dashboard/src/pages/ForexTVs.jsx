import { useEffect, useState } from 'react'
import { getForexTVs, setForexMode, getForexRates } from '../api'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen + 'Z').getTime()) < 2 * 60 * 1000
}

export default function ForexTVs() {
  const [tvs, setTvs] = useState([])
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  useEffect(() => {
    Promise.all([getForexTVs(), getForexRates()])
      .then(([tvsData, ratesData]) => {
        setTvs(tvsData)
        setRates(ratesData)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggle(tv) {
    setToggling(tv.id)
    try {
      const newMode = tv.forex_mode ? 0 : 1
      await setForexMode(tv.id, newMode)
      setTvs(prev => prev.map(t => t.id === tv.id ? { ...t, forex_mode: newMode } : t))
    } finally {
      setToggling(null)
    }
  }

  const forexTVs = tvs.filter(t => t.forex_mode === 1)
  const otherTVs = tvs.filter(t => t.forex_mode === 0)

  const byAgency = otherTVs.reduce((acc, tv) => {
    const key = tv.agency_name
    if (!acc[key]) acc[key] = []
    acc[key].push(tv)
    return acc
  }, {})

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500">Se încarcă...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Schimb Valutar</h1>
        <p className="text-slate-500 text-sm mt-1">TV-uri alocate pentru afișaj cursuri de schimb</p>
      </div>

      {rates?.updatedAt && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-700 font-medium">
            Cursuri CEC actualizate la {new Date(rates.updatedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {rates.rates && (
            <span className="text-sm text-green-600 ml-2">
              EUR {rates.rates.EUR?.buy?.toFixed(4)} / {rates.rates.EUR?.sell?.toFixed(4)}
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

      {forexTVs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">TV-uri active schimb valutar</h2>
          <div className="space-y-2">
            {forexTVs.map(tv => (
              <div key={tv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOnline(tv.last_seen_at) ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <div>
                    <p className="font-medium text-slate-900">{tv.label}</p>
                    <p className="text-sm text-slate-500">{tv.agency_name} · {tv.city}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(tv)}
                  disabled={toggling === tv.id}
                  className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {toggling === tv.id ? '...' : 'Dezactivează'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(byAgency).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">Toate TV-urile — activează schimb valutar</h2>
          <div className="space-y-4">
            {Object.entries(byAgency).map(([agencyName, agencyTvs]) => (
              <div key={agencyName} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-sm font-semibold text-slate-700">{agencyName}</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {agencyTvs.map(tv => (
                    <div key={tv.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isOnline(tv.last_seen_at) ? 'bg-green-500' : 'bg-slate-300'}`} />
                        <span className="text-sm text-slate-700">{tv.label}</span>
                      </div>
                      <button
                        onClick={() => toggle(tv)}
                        disabled={toggling === tv.id}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {toggling === tv.id ? '...' : 'Activează forex'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tvs.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">Niciun TV înregistrat</p>
          <p className="text-sm mt-1">TV-urile apar automat când se conectează</p>
        </div>
      )}
    </div>
  )
}
