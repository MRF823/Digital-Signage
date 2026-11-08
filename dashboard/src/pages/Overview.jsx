import { useState, useEffect, useRef } from 'react'
import { getAgencies, getGroups, getCampaigns, getRates, getStats, getUptime7d, triggerUpdate } from '../api'

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'Z')
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isActiveCampaign(c) {
  const now = new Date()
  return new Date(c.start_date) <= now && now <= new Date(c.end_date)
}

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

const DAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']

function Sparkbar({ color, heights = [null,null,null,null,null,null,null], todayIndex = 0 }) {
  const DAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
  return (
    <div style={{ marginTop: 10 }}>
      {/* Bare + procent deasupra */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:'3px' }}>
        {DAYS.map((_, i) => {
          const h = heights[i]
          // Duminica (i=6) afișează săptămâna trecută când azi nu e duminică
          const isSundayPast = i === 6 && todayIndex < 6
          const isPast = (i < todayIndex || isSundayPast) && h !== null
          const isToday = i === todayIndex
          const isFuture = !isPast && !isToday
          const barPx = h !== null ? Math.max((h / 100) * 36, 3) : 3

          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
              {/* Procent — doar zilele trecute (nu azi, nu viitoare) */}
              <div style={{ fontSize:8, fontWeight:700, lineHeight:1, marginBottom:2, minHeight:9,
                color: isPast ? color : 'transparent' }}>
                {isPast ? `${h}%` : ''}
              </div>
              {/* Bara */}
              <div style={{
                width:'100%', borderRadius:3,
                background: isFuture ? 'var(--border)' : color,
                height: isFuture ? 3 : barPx,
                opacity: isFuture ? 0.4 : isToday ? 0.6 : 1,
              }} />
            </div>
          )
        })}
      </div>
      {/* Etichete zi */}
      <div style={{ display:'flex', gap:'3px', marginTop:3 }}>
        {DAYS.map((d, i) => {
          const isSundayPast = i === 6 && todayIndex < 6
          const isFutureLabel = i > todayIndex && !isSundayPast
          return (
          <div key={i} style={{
            flex:1, textAlign:'center', fontSize:9, lineHeight:1,
            fontWeight: i === todayIndex ? 700 : 500,
            color: isFutureLabel ? 'var(--border)' : i === todayIndex ? color : 'var(--fg-3)',
          }}>{d}</div>
        )})}
      </div>
    </div>
  )
}

// V4 stat tile: colored 3px top border + sparkbar
function Tile({ label, value, sub, accent, sparks, sparkTodayIndex, badge }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px 14px', position: 'relative',
      overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: '12px 12px 0 0'
      }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing:'.4px' }}>{label}</span>
        {badge && <span style={{ fontSize: 10.5, fontWeight: 700, padding:'2px 7px', borderRadius: 99,
          background: 'var(--chip-slate-bg)', color: 'var(--chip-slate-fg)' }}>{badge}</span>}
      </div>
      <div style={{ fontFamily:'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 30, fontWeight: 800,
        lineHeight: 1, letterSpacing:'-.5px', fontVariantNumeric:'tabular-nums', color: accent }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{sub}</div>}
      {sparks && <Sparkbar color={accent} heights={sparks} todayIndex={sparkTodayIndex ?? 0} />}
    </div>
  )
}

// Donut chart SVG
function Donut({ online, total }) {
  const offline = total - online
  const pct = total > 0 ? online / total : 0
  const r = 44, circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div style={{ position:'relative', width:110, height:110, flexShrink:0 }}>
      <svg width="110" height="110" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="11"/>
        {total > 0 && (
          <circle cx="55" cy="55" r={r} fill="none" stroke="#10B981" strokeWidth="11"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"/>
        )}
        {offline > 0 && (
          <circle cx="55" cy="55" r={r} fill="none" stroke="#EF4444" strokeWidth="11"
            strokeDasharray={`${circ - dash} ${circ}`}
            strokeDashoffset={-dash}/>
        )}
      </svg>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <div style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontSize: 18, fontWeight: 800, lineHeight:1, color:'var(--fg)' }}>
          {total > 0 ? Math.round(pct * 100) : 0}%
        </div>
        <div style={{ fontSize: 10, color:'var(--fg-3)', marginTop: 2 }}>online</div>
      </div>
    </div>
  )
}

// Region block (expandable group)
function RegionBlock({ group, agencies }) {
  const [open, setOpen] = useState(true)
  const groupAgencies = agencies.filter(a => group.agencies.some(ga => ga.id === a.id))
  const allTvs = groupAgencies.flatMap(a => a.tvs)
  const onlineCount = allTvs.filter(isOnline).length

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
      {/* Header */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px',
          background:'var(--surface-2)', borderBottom: open ? '1px solid var(--border)' : 'none',
          cursor:'pointer', userSelect:'none' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:13, flex:1, color:'var(--fg)' }}>{group.name}</span>
        <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:99,
          background:'var(--chip-on-bg)', color:'var(--chip-on-fg)' }}>● {onlineCount} online</span>
        {onlineCount < allTvs.length && (
          <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:99,
            background:'var(--chip-off-bg)', color:'var(--chip-off-fg)', marginLeft:4 }}>● {allTvs.length-onlineCount} offline</span>
        )}
        <svg style={{ transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color:'var(--fg-3)' }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* Agency grid */}
      {open && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10, padding:12, background:'var(--surface-2)' }}>
          {groupAgencies.map(agency => (
            <div key={agency.id} style={{ background:'var(--surface)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8,
              border:'1px solid var(--border)', borderRadius:9, boxShadow:'var(--shadow-sm)' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:12.5, color:'var(--fg)' }}>{agency.name}</div>
                {agency.city && <div style={{ fontSize:11, color:'var(--fg-3)', marginTop:1 }}>{agency.city}</div>}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {agency.tvs.map(tv => {
                  const on = isOnline(tv)
                  return (
                    <div key={tv.id} style={{
                      display:'flex', alignItems:'center', gap:7, padding:'5px 8px',
                      borderRadius:7, border:'1px solid var(--border)', cursor:'default',
                      background: on ? 'var(--chip-on-bg)' : 'var(--chip-off-bg)'
                    }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                        background: on ? '#10B981' : '#EF4444',
                        boxShadow: on ? '0 0 0 2px rgba(16,185,129,.2)' : 'none' }} />
                      <span style={{ fontSize:12, fontWeight:500, flex:1, color:'var(--fg-2)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tv.label}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:4,
                        background: tv.orientation === 'portrait' ? 'rgba(139,92,246,.15)' : 'rgba(37,99,235,.12)',
                        color: tv.orientation === 'portrait' ? '#7C3AED' : '#2563EB', flexShrink:0 }}>
                        {tv.orientation === 'portrait' ? 'PORT' : 'LAND'}
                      </span>
                      {!on && tv.last_seen_at && (
                        <span style={{ fontSize:10, color:'var(--fg-3)', flexShrink:0 }}>{fmtDate(tv.last_seen_at)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Overview() {
  const [agencies, setAgencies] = useState([])
  const [groups, setGroups] = useState([])
  const [mediaCount, setMediaCount] = useState(0)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [plays24h, setPlays24h] = useState(0)
  const [uptime7d, setUptime7d] = useState({ days: [null,null,null,null,null,null,null], todayIndex: 0 })
  const [rates, setRates] = useState(null)
  const [ratesTime, setRatesTime] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`)
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

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
    getUptime7d().then(d => { if (d?.days) setUptime7d({ days: d.days, todayIndex: d.todayIndex ?? 0 }) }).catch(() => {})
  }

  const loadRates = () =>
    getRates().then(d => {
      if (d?.rates) { setRates(d.rates); setRatesTime(d.updatedAt) }
    }).catch(() => {})

  useEffect(() => {
    load(); loadRates()
    const i1 = setInterval(load, 15_000)
    const i2 = setInterval(loadRates, 60_000)
    return () => { clearInterval(i1); clearInterval(i2) }
  }, [])

  const allTvs = agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name })))
  const online = allTvs.filter(isOnline).length
  const offline = allTvs.length - online

  const groupHasPlaylist = {}
  groups.forEach(g => { groupHasPlaylist[g.id] = (g.playlist?.length ?? 0) > 0 })
  const groupIdForAgency = {}
  groups.forEach(g => g.agencies.forEach(a => { groupIdForAgency[a.id] = g.id }))
  const agenciesNoContent = agencies.filter(a => {
    const gid = groupIdForAgency[a.id]
    if (gid) return !groupHasPlaylist[gid]
    return !(a.playlist?.length > 0)
  })

  const rateTime = ratesTime?.match(/(\d{2}:\d{2})$/)?.[1] || null
  const rateDate = ratesTime?.match(/^(\d{2}\.\d{2}\.\d{4})/)?.[1] || null

  const handleUpdate = async () => {
    setUpdating(true); setUpdateMsg('')
    try {
      const res = await triggerUpdate()
      setUpdateMsg(res.agents === 0
        ? 'Niciun mini PC conectat momentan.'
        : `Comandă trimisă către ${res.agents} mini PC${res.agents > 1 ? '-uri' : ''}. ~2 min.`)
    } catch { setUpdateMsg('Eroare la trimiterea comenzii.') }
    setUpdating(false)
    setTimeout(() => setUpdateMsg(''), 6000)
  }

  // Ungrouped agencies
  const groupedIds = new Set(groups.flatMap(g => g.agencies.map(a => a.id)))
  const ungroupedAgencies = agencies.filter(a => !groupedIds.has(a.id))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, padding: 24 }}>

      {/* ─── Topbar ─── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
        <div style={{ flex:1 }}>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, system-ui, sans-serif', fontWeight:800, fontSize:20, color:'var(--fg)', letterSpacing:'-.3px' }}>
            Prezentare generală
          </h2>
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', display:'inline-block',
              animation:'pulse 2s infinite' }} />
            Status în timp real · {clock}
          </p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <button onClick={handleUpdate} disabled={updating}
            style={{ display:'flex', alignItems:'center', gap:6, height:34, padding:'0 16px',
              borderRadius:8, background: updating ? '#93C5FD' : '#2563EB', color:'#fff',
              border:'none', fontSize:13, fontWeight:600, cursor: updating ? 'default' : 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
            </svg>
            {updating ? 'Se actualizează...' : 'Actualizează mini PC-uri'}
          </button>
          {updateMsg && <p style={{ fontSize:11.5, color:'var(--fg-3)', maxWidth:260, textAlign:'right' }}>{updateMsg}</p>}
        </div>
      </div>

      {/* ─── 4 Stat tiles ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <Tile label="TV-uri online" value={online} sub={`din ${allTvs.length} totale`}
          accent="#2563EB" sparks={uptime7d.days} sparkTodayIndex={uptime7d.todayIndex} />
        <Tile label="TV-uri offline" value={offline} sub="necesită atenție"
          accent="#EF4444" />
        <Tile label="Afișări 24h" value={plays24h.toLocaleString('ro-RO')} sub="ultimele 24 ore"
          accent="#10B981" />
        <Tile label="Fără conținut" value={agenciesNoContent.length} sub="agenții"
          accent="#F59E0B" />
      </div>

      {/* ─── Main layout: left (regions) + right (donut + forex) ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:16, alignItems:'start' }}>

        {/* LEFT: region blocks */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {groups.map(group => (
            <RegionBlock key={group.id} group={group} agencies={agencies} />
          ))}
          {/* Ungrouped */}
          {ungroupedAgencies.length > 0 && (
            <RegionBlock
              group={{ name: 'Agenții negrupate', agencies: ungroupedAgencies.map(a => ({ id: a.id })) }}
              agencies={agencies}
            />
          )}
        </div>

        {/* RIGHT column */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Donut card */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
              <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:13, color:'var(--fg)' }}>Status TV-uri</span>
            </div>
            <div style={{ padding:16, display:'flex', alignItems:'center', gap:16 }}>
              <Donut online={online} total={allTvs.length} />
              <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                {[
                  { label:'Online', count:online, color:'#10B981' },
                  { label:'Offline', count:offline, color:'#EF4444' },
                  { label:'Total', count:allTvs.length, color:'var(--fg-3)' },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                    <span style={{ width:9, height:9, borderRadius:'50%', background:row.color, flexShrink:0 }} />
                    <span style={{ flex:1, color:'var(--fg-2)' }}>{row.label}</span>
                    <span style={{ fontWeight:700, color:'var(--fg)', fontVariantNumeric:'tabular-nums' }}>{row.count}</span>
                  </div>
                ))}
                <div style={{ marginTop:4, paddingTop:8, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--fg-3)' }}>
                  <span>Campanii active</span>
                  <strong style={{ color:'var(--fg)' }}>{activeCampaigns}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--fg-3)' }}>
                  <span>Fișiere media</span>
                  <strong style={{ color:'var(--fg)' }}>{mediaCount}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Forex card */}
          {rates && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:13, color:'var(--fg)' }}>Curs valutar</span>
                {rateTime && <span style={{ fontSize:11, color:'var(--fg-3)' }}>{rateTime} · {rateDate}</span>}
              </div>
              <div style={{ padding:'8px 0' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'4px 14px 6px',
                  fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--fg-3)' }}>
                  <span>Valută</span><span style={{ textAlign:'right' }}>Cumpărare</span><span style={{ textAlign:'right' }}>Vânzare</span>
                </div>
                <div style={{ borderTop:'1px solid var(--border)' }}>
                  {CURRENCIES.map(cur => {
                    const r = rates[cur]
                    if (!r) return null
                    return (
                      <div key={cur} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
                        padding:'8px 14px', borderBottom:'1px solid var(--border)', fontSize:12.5 }}>
                        <span style={{ fontWeight:600, color:'var(--fg)' }}>{cur}</span>
                        <span style={{ textAlign:'right', fontVariantNumeric:'tabular-nums', color:'var(--fg-2)' }}>{r.buy?.toFixed(4)}</span>
                        <span style={{ textAlign:'right', fontVariantNumeric:'tabular-nums', color:'var(--fg-2)' }}>{r.sell?.toFixed(4)}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ padding:'6px 14px', fontSize:11, color:'var(--fg-3)', display:'flex', justifyContent:'space-between' }}>
                  <span>CEC Bank</span>
                  <span style={{ color:'var(--accent)', fontWeight:600, fontSize:11 }}>● Live</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick stats card */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
              <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:13, color:'var(--fg)' }}>Agenții fără conținut</span>
            </div>
            <div style={{ padding: agenciesNoContent.length === 0 ? 16 : 0 }}>
              {agenciesNoContent.length === 0 ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#059669' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Toate agențiile au conținut
                </div>
              ) : (
                agenciesNoContent.map(a => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
                    borderBottom:'1px solid var(--border)', fontSize:12.5 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:'#F59E0B', flexShrink:0 }} />
                    <span style={{ color:'var(--fg-2)' }}>{a.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  )
}
