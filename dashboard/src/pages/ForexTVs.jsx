import { useEffect, useState } from 'react'
import { getForexTVs, getForexRates } from '../api'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return (Date.now() - new Date(lastSeen + 'Z').getTime()) < 2 * 60 * 1000
}

export default function ForexTVs() {
  const [tvs, setTvs] = useState([])
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getForexTVs(), getForexRates()])
      .then(([tvsData, ratesData]) => {
        const forexOnly = tvsData.filter(t =>
          t.label.toLowerCase() === 'tv schimb valutar'
        )
        setTvs(forexOnly)
        setRates(ratesData)
      })
      .finally(() => setLoading(false))
  }, [])

  const byAgency = tvs.reduce((acc, tv) => {
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

      {tvs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">Niciun TV schimb valutar înregistrat</p>
          <p className="text-sm mt-1">Conectează un mini PC cu label-ul "TV schimb valutar"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byAgency).map(([agencyName, agencyTvs]) => (
            <div key={agencyName} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-700">{agencyName}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {agencyTvs.map(tv => (
                  <div key={tv.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${isOnline(tv.last_seen_at) ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{tv.label}</p>
                      <p className="text-xs text-slate-400">
                        {isOnline(tv.last_seen_at) ? 'Online' : tv.last_seen_at ? `Ultima dată online: ${new Date(tv.last_seen_at + 'Z').toLocaleString('ro-RO')}` : 'Niciodată conectat'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
