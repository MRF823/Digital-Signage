import { useState, useEffect } from 'react'
import { getAgencies, getGroups, getMedia, getCampaigns, getRates, getStats } from '../api'

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

const ICONS = {
  tv_online: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      <circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  tv_offline: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      <line x1="9" y1="8" x2="15" y2="12"/><line x1="15" y1="8" x2="9" y2="12"/>
    </svg>
  ),
  plays: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  no_content: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 15s1.5-2 4-2 4 2 4 2"/>
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  media: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.5"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  campaign: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h2M14 14h2M8 18h2M14 18h2"/>
    </svg>
  ),
}

function StatCard({ label, value, sub, color, icon, iconBg }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3.5 flex items-center gap-3">
      {icon && (
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconBg ?? 'bg-gray-100'}`}>
          <span className={color ?? 'text-gray-500'}>
            {/* render icon at 18x18 */}
            {(() => {
              const el = ICONS[icon]
              return el ? { ...el, props: { ...el.props, width: 18, height: 18 } } : null
            })()}
          </span>
        </div>
      )}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${color ?? 'text-gray-800'}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
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
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide ${tv.orientation === 'portrait' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {tv.orientation === 'portrait' ? 'PORT' : 'LAND'}
              </span>
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
  const [plays24h, setPlays24h] = useState(0)
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
    getStats().then(s => setPlays24h(s.plays_24h ?? 0)).catch(() => {})
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

  // Agenții fără conținut real (fără playlist propriu ȘI fără grup cu playlist)
  const groupHasPlaylist = {}
  groups.forEach(g => { groupHasPlaylist[g.id] = (g.playlist?.length ?? 0) > 0 })
  const groupIdForAgency = {}
  groups.forEach(g => g.agencies.forEach(a => { groupIdForAgency[a.id] = g.id }))
  const agenciesNoContent = agencies.filter(a => {
    const gid = groupIdForAgency[a.id]
    if (gid) return !groupHasPlaylist[gid]
    return !(a.playlist?.length > 0)
  })

  const ratesDate = ratesTime ? new Date(ratesTime) : null
  const time = ratesDate
    ? ratesDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null
  const date = ratesDate
    ? ratesDate.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Prezentare generală</h2>
        <p className="text-sm text-gray-400 mt-0.5">Status în timp real · actualizat la 15s</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="TV-uri online"
          value={online}
          sub={`din ${allTvs.length} total`}
          color={offline > 0 ? 'text-amber-600' : 'text-green-600'}
          icon="tv_online"
          iconBg={offline > 0 ? 'bg-amber-50' : 'bg-green-50'}
        />
        <StatCard
          label="TV-uri offline"
          value={offline}
          color={offline > 0 ? 'text-red-500' : 'text-gray-400'}
          icon="tv_offline"
          iconBg={offline > 0 ? 'bg-red-50' : 'bg-gray-50'}
        />
        <StatCard
          label="Afișări 24h"
          value={plays24h.toLocaleString('ro-RO')}
          color="text-teal-600"
          icon="plays"
          iconBg="bg-teal-50"
        />
        <StatCard
          label="Agenții fără conținut"
          value={agenciesNoContent.length}
          color={agenciesNoContent.length > 0 ? 'text-red-500' : 'text-gray-400'}
          icon="no_content"
          iconBg={agenciesNoContent.length > 0 ? 'bg-red-50' : 'bg-gray-50'}
        />
        <StatCard
          label="Fișiere media"
          value={mediaCount}
          icon="media"
          iconBg="bg-purple-50"
          color="text-purple-600"
        />
        <StatCard
          label="Campanii active"
          value={activeCampaigns}
          color="text-blue-600"
          icon="campaign"
          iconBg="bg-blue-50"
        />
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
            {time && (
              <div className="text-right">
                <p className="text-xs text-gray-400">{time}</p>
                <p className="text-xs text-gray-300">{date}</p>
              </div>
            )}
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
                  {time && <span className="text-xs text-gray-400">{date} · {time}</span>}
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
