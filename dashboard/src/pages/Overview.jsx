import { useState, useEffect } from 'react'
import { getAgencies, getGroups, getMedia, getCampaigns, getRates } from '../api'

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  if (diff < 60_000) return 'acum'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min`
  return `${Math.round(diff / 3_600_000)}h`
}

function isActiveCampaign(c) {
  const now = new Date()
  return new Date(c.start_date) <= now && now <= new Date(c.end_date)
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function AgencyCard({ agency }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600 mb-2 truncate">{agency.name}</p>
      <div className="flex gap-2 flex-wrap">
        {agency.tvs.map(tv => {
          const on = isOnline(tv)
          return (
            <div key={tv.id} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs
              ${on ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={`font-semibold ${on ? 'text-green-700' : 'text-red-500'}`}>{tv.label}</span>
              <span className={`text-xs ${on ? 'text-green-500' : 'text-red-400'}`}>{timeAgo(tv.last_seen_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

export default function Overview() {
  const [agencies, setAgencies] = useState([])
  const [groups, setGroups] = useState([])
  const [mediaCount, setMediaCount] = useState(0)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [rates, setRates] = useState(null)
  const [ratesTime, setRatesTime] = useState(null)

  const load = async () => {
    const [ag, gr, med, camp] = await Promise.all([
      getAgencies().catch(() => []),
      getGroups().catch(() => []),
      getMedia().catch(() => []),
      getCampaigns().catch(() => []),
    ])
    setAgencies(ag)
    setGroups(gr)
    setMediaCount(med.length)
    setActiveCampaigns(camp.filter(isActiveCampaign).length)
  }

  const loadRates = () =>
    getRates().then(d => {
      if (d?.rates) { setRates(d.rates); setRatesTime(d.updatedAt) }
    }).catch(() => {})

  useEffect(() => {
    load(); loadRates()
    const i1 = setInterval(load, 15_000)
    const i2 = setInterval(loadRates, 15_000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [])

  const allTvs = agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name, city: a.city })))
  const online = allTvs.filter(isOnline).length
  const offline = allTvs.length - online

  // Agenții grupate
  const groupedAgencyIds = new Set(groups.flatMap(g => g.agencies.map(a => a.id)))
  const ungrouped = agencies.filter(a => !groupedAgencyIds.has(a.id))

  const time = ratesTime
    ? new Date(ratesTime).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Prezentare generală</h2>
        <p className="text-sm text-gray-400 mt-0.5">Status în timp real · actualizat la 15s</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="TV-uri online"
          value={online}
          sub={`din ${allTvs.length} total`}
          color={offline > 0 ? 'text-amber-600' : 'text-green-600'}
        />
        <StatCard label="TV-uri offline" value={offline} color={offline > 0 ? 'text-red-500' : 'text-gray-400'} />
        <StatCard label="Fișiere media" value={mediaCount} />
        <StatCard label="Campanii active" value={activeCampaigns} color="text-blue-600" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* TV status grupat */}
        <div className="col-span-2 grid grid-cols-2 gap-4 items-start">
          {groups.map(group => {
            const groupAgencies = agencies.filter(a => group.agencies.some(ga => ga.id === a.id))
            const groupTvs = groupAgencies.flatMap(a => a.tvs)
            const groupOnline = groupTvs.filter(isOnline).length
            const pct = groupTvs.length ? Math.round((groupOnline / groupTvs.length) * 100) : 0
            return (
              <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-700 text-sm">{group.name}</h3>
                    <span className={`text-xs font-medium ${groupOnline === groupTvs.length ? 'text-green-600' : groupOnline === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                      {groupOnline}/{groupTvs.length} online
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${groupOnline === groupTvs.length ? 'bg-green-500' : groupOnline === 0 ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {groupAgencies.map(agency => (
                    <AgencyCard key={agency.id} agency={agency} />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Agenții fără grup */}
          {ungrouped.length > 0 && (
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-500 text-sm">Fără grup</h3>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {ungrouped.map(agency => (
                  <AgencyCard key={agency.id} agency={agency} />
                ))}
              </div>
            </div>
          )}

          {groups.length === 0 && ungrouped.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-8 text-center text-gray-400 text-sm">
              Nicio agenție înregistrată
            </div>
          )}
        </div>

        {/* Curs valutar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">Curs valutar</h3>
            {time && <span className="text-xs text-gray-400">{time}</span>}
          </div>

          {!rates ? (
            <p className="px-5 py-6 text-xs text-gray-400 text-center">Se încarcă...</p>
          ) : (
            <div>
              {/* CEC */}
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-2">CEC Bank</p>
                {CURRENCIES.map(c => {
                  const r = rates[c]
                  const hasCec = r?.buy != null || r?.sell != null
                  return (
                    <div key={c} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-bold text-gray-600 w-10">{c}</span>
                      {hasCec ? (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-400 text-xs">cmp</span>
                          <span className="font-semibold text-gray-800 tabular-nums">{r.buy?.toFixed(4)}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-gray-400 text-xs">vnd</span>
                          <span className="font-semibold text-gray-800 tabular-nums">{r.sell?.toFixed(4)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* BNR */}
              <div className="px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">BNR Referință</p>
                  {time && <span className="text-xs text-gray-400">{time}</span>}
                </div>
                {CURRENCIES.map(c => (
                  <div key={c} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-bold text-gray-600 w-10">{c}</span>
                    <span className="font-semibold text-gray-800 tabular-nums text-sm">
                      {rates[c]?.reference != null ? rates[c].reference.toFixed(4) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
