import { useState, useEffect } from 'react'
import { getAgencies, getGroups, getCampaigns, getRates, getStats, triggerUpdate } from '../api'

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

function timeAgo(dateStr) {
  if (!dateStr) return { rel: '—', exact: '' }
  const date = new Date(dateStr + 'Z')
  const diff = Date.now() - date.getTime()
  const pad = n => String(n).padStart(2, '0')
  const exact = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}\n${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (diff < 60_000) return { rel: 'Online', exact }
  return { rel: '', exact }
}

function isActiveCampaign(c) {
  const now = new Date()
  return new Date(c.start_date) <= now && now <= new Date(c.end_date)
}

// V4 stat tile: colored top border + large value
function V4Tile({ label, value, sub, color, borderColor, accentClass }) {
  return (
    <div className="rounded-xl border overflow-hidden relative"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      {/* Colored top border */}
      <div className="h-[3px] w-full" style={{ background: borderColor }} />
      <div className="px-4 py-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[.5px] mb-1.5"
          style={{ color: 'var(--fg-3)' }}>
          {label}
        </p>
        <p className={`text-[32px] font-extrabold leading-none tabular-nums ${accentClass}`}
          style={{ color: color || 'var(--fg)' }}>
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--fg-3)' }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

function AgencyCard({ agency }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-semibold mb-2 truncate" style={{ color: 'var(--fg-2)' }}>{agency.name}</p>
      <div className="flex gap-2 flex-wrap">
        {agency.tvs.map(tv => {
          const on = isOnline(tv)
          return (
            <div key={tv.id} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs
              ${on ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className={`font-semibold ${on ? 'text-green-700' : 'text-red-500'}`}>{tv.label}</span>
              {(() => { const { rel, exact } = timeAgo(tv.last_seen_at); return (<>
                <span className={`text-xs ${on ? 'text-green-500' : 'text-red-400'}`}>{rel}</span>
                {!on && exact && <span className="text-[9px] text-gray-800 text-center whitespace-pre-line leading-tight font-semibold">{exact}</span>}
              </>)})()}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide ${tv.orientation === 'portrait' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {tv.orientation === 'portrait' ? 'PORT.' : 'LAND.'}
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
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')

  const load = async () => {
    const [ag, gr, camp] = await Promise.all([
      getAgencies().catch(() => []),
      getGroups().catch(() => []),
      getCampaigns().catch(() => []),
    ])
    setAgencies(ag)
    setGroups(gr)
    setActiveCampaigns(camp.filter(isActiveCampaign).length)
    getStats().then(s => {
      setPlays24h(s.plays_24h ?? 0)
      setMediaCount(s.active_files ?? 0)
    }).catch(() => {})
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

  const groupedAgencyIds = new Set(groups.flatMap(g => g.agencies.map(a => a.id)))
  const ungrouped = agencies.filter(a => !groupedAgencyIds.has(a.id))

  const groupHasPlaylist = {}
  groups.forEach(g => { groupHasPlaylist[g.id] = (g.playlist?.length ?? 0) > 0 })
  const groupIdForAgency = {}
  groups.forEach(g => g.agencies.forEach(a => { groupIdForAgency[a.id] = g.id }))
  const agenciesNoContent = agencies.filter(a => {
    const gid = groupIdForAgency[a.id]
    if (gid) return !groupHasPlaylist[gid]
    return !(a.playlist?.length > 0)
  })

  const time = ratesTime?.match(/(\d{2}:\d{2})$/)?.[1] || null
  const date = ratesTime?.match(/^(\d{2}\.\d{2}\.\d{4})/)?.[1] || null

  const handleUpdate = async () => {
    setUpdating(true)
    setUpdateMsg('')
    try {
      const res = await triggerUpdate()
      if (res.agents === 0) {
        setUpdateMsg('Niciun mini PC conectat momentan.')
      } else {
        setUpdateMsg(`Comandă trimisă către ${res.agents} mini PC${res.agents > 1 ? '-uri' : ''}. Actualizarea durează ~2 min.`)
      }
    } catch {
      setUpdateMsg('Eroare la trimiterea comenzii.')
    }
    setUpdating(false)
    setTimeout(() => setUpdateMsg(''), 6000)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Prezentare generală</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-3)' }}>Status în timp real · actualizat la 15s</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {updating ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                Se actualizează...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
                Actualizează mini PC-uri
              </>
            )}
          </button>
          {updateMsg && (
            <p className="text-xs max-w-xs text-right" style={{ color: 'var(--fg-3)' }}>{updateMsg}</p>
          )}
        </div>
      </div>

      {/* V4 Stat tiles */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <V4Tile
          label="TV-uri online"
          value={online}
          sub={`din ${allTvs.length} total`}
          borderColor="#2563EB"
          color={offline > 0 ? undefined : '#059669'}
        />
        <V4Tile
          label="TV-uri offline"
          value={offline}
          borderColor="#EF4444"
          color={offline > 0 ? '#EF4444' : undefined}
        />
        <V4Tile
          label="Afișări 24h"
          value={plays24h.toLocaleString('ro-RO')}
          borderColor="#10B981"
          color="#059669"
        />
        <V4Tile
          label="Agenții fără conținut"
          value={agenciesNoContent.length}
          borderColor="#F59E0B"
          color={agenciesNoContent.length > 0 ? '#D97706' : undefined}
        />
        <V4Tile
          label="Fișiere media"
          value={mediaCount}
          borderColor="#8B5CF6"
          color="#7C3AED"
        />
        <V4Tile
          label="Campanii active"
          value={activeCampaigns}
          borderColor="#2563EB"
          color="#2563EB"
        />
      </div>

      {/* Groups + forex */}
      <div className="grid grid-cols-3 gap-6">
        {/* TV status grupat */}
        <div className="col-span-2 grid grid-cols-2 gap-4 items-start">
          {groups.map(group => {
            const groupAgencies = agencies.filter(a => group.agencies.some(ga => ga.id === a.id))
            const groupTvs = groupAgencies.flatMap(a => a.tvs)
            const groupOnline = groupTvs.filter(isOnline).length
            const pct = groupTvs.length ? Math.round((groupOnline / groupTvs.length) * 100) : 0
            return (
              <div key={group.id} className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--fg-2)' }}>{group.name}</h3>
                    <span className={`text-xs font-medium ${groupOnline === groupTvs.length ? 'text-green-600' : groupOnline === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                      {groupOnline}/{groupTvs.length} online
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
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

          {ungrouped.length > 0 && (
            <div className="col-span-2 rounded-xl border overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--fg-3)' }}>Fără grup</h3>
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                {ungrouped.map(agency => (
                  <AgencyCard key={agency.id} agency={agency} />
                ))}
              </div>
            </div>
          )}

          {groups.length === 0 && ungrouped.length === 0 && (
            <div className="rounded-xl border px-5 py-8 text-center text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--fg-3)' }}>
              Nicio agenție înregistrată
            </div>
          )}
        </div>

        {/* Curs valutar */}
        <div className="rounded-xl border overflow-hidden h-fit"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Curs valutar</h3>
            {time && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--fg-3)' }}>{time}</p>
                <p className="text-xs" style={{ color: 'var(--fg-3)', opacity: .6 }}>{date}</p>
              </div>
            )}
          </div>

          {!rates ? (
            <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--fg-3)' }}>Se încarcă...</p>
          ) : (
            <div>
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-2">CEC Bank</p>
                {CURRENCIES.map(c => {
                  const r = rates[c]
                  const hasCec = r?.buy != null || r?.sell != null
                  return (
                    <div key={c} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-bold w-10" style={{ color: 'var(--fg-2)' }}>{c}</span>
                      {hasCec ? (
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-xs" style={{ color: 'var(--fg-3)' }}>cmp</span>
                          <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>{r.buy?.toFixed(4)}</span>
                          <span style={{ color: 'var(--border-2)' }}>/</span>
                          <span className="text-xs" style={{ color: 'var(--fg-3)' }}>vnd</span>
                          <span className="font-semibold tabular-nums" style={{ color: 'var(--fg)' }}>{r.sell?.toFixed(4)}</span>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--border-2)' }}>—</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">BNR Referință</p>
                  {time && <span className="text-xs" style={{ color: 'var(--fg-3)' }}>{date} · {time}</span>}
                </div>
                {CURRENCIES.map(c => (
                  <div key={c} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-bold w-10" style={{ color: 'var(--fg-2)' }}>{c}</span>
                    <span className="font-semibold tabular-nums text-sm" style={{ color: 'var(--fg)' }}>
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
