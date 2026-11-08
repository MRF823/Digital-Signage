import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { getPlayLog, getReportsSummary, getAgencies, getGroups, getPlaylist, getGroupPlaylist, getUptimeReport } from '../api'

function fmt(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'Z'))
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function fmtDuration(sec) {
  if (sec == null || sec === 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtDurationLong(sec) {
  if (!sec) return '0s'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const RO_MONTHS = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec']
function fmtDateDisplay(val) {
  if (!val) return '—'
  const [y, m, d] = val.split('-')
  return `${d} ${RO_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function playlistDuration(items, avgDurations = {}) {
  return items.reduce((s, item) => {
    if (item.type === 'video') {
      const d = item.duration_seconds ?? avgDurations[item.filename] ?? 0
      return s + d
    }
    return s + (item.display_duration_seconds ?? 10)
  }, 0)
}

function downloadExcel(summary, logs, agencies, playlists, avgDurations = {}) {
  const agencyMap = {}
  agencies.forEach(a => { agencyMap[a.id] = { name: a.name, city: a.city } })

  const summaryRows = [['Agenție', 'Oraș', 'Total redări', 'Durată totală', 'Durată playlist', 'Cicluri complete']]
  ;(summary?.byAgency ?? []).forEach(r => {
    const ag = agencyMap[r.agency_id] ?? { name: `#${r.agency_id}`, city: '' }
    const pd = playlists[r.agency_id] ? playlistDuration(playlists[r.agency_id], avgDurations) : 0
    const cycles = pd > 0 ? Math.floor(r.total_seconds / pd) : '—'
    summaryRows.push([ag.name, ag.city, r.plays, fmtDurationLong(r.total_seconds), fmtDurationLong(pd), cycles])
  })

  const detailRows = [['Data / Ora', 'Agenție', 'TV', 'Fișier', 'Tip', 'Durată']]
  logs.forEach(r => {
    const ag = agencyMap[r.agency_id]
    detailRows.push([fmt(r.played_at), ag?.name ?? `#${r.agency_id}`, r.tv_label, r.original_name, r.media_type, fmtDuration(r.duration_seconds)])
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Sumar')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), 'Detaliat')
  XLSX.writeFile(wb, 'proof-of-play.xlsx')
}

export default function Reports() {
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [agencies, setAgencies] = useState([])
  const [playlists, setPlaylists] = useState({})
  const [agencyId, setAgencyId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasFiltered, setHasFiltered] = useState(false)
  const fromRef = useRef()
  const toRef = useRef()
  const [uptimeData, setUptimeData] = useState({})
  const [uptimeLoading, setUptimeLoading] = useState(false)
  const [nextRefresh, setNextRefresh] = useState(60)

  useEffect(() => {
    Promise.all([getAgencies(), getGroups()]).then(async ([ag, groups]) => {
      setAgencies(ag)
      const agencyGroupId = {}
      groups.forEach(g => g.agencies.forEach(a => { agencyGroupId[a.id] = g.id }))
      const directResults = await Promise.all(
        ag.map(a => getPlaylist(a.id).then(items => ({ id: a.id, items })).catch(() => ({ id: a.id, items: [] })))
      )
      const groupPlaylistMap = {}
      await Promise.all(groups.map(g => getGroupPlaylist(g.id).then(items => { groupPlaylistMap[g.id] = items }).catch(() => {})))
      const map = {}
      directResults.forEach(r => {
        if (r.items.length === 0 && agencyGroupId[r.id]) map[r.id] = groupPlaylistMap[agencyGroupId[r.id]] || []
        else map[r.id] = r.items
      })
      setPlaylists(map)
    }).catch(() => {})
  }, [])

  const load = (opts = {}) => {
    const aid = opts.agencyId !== undefined ? opts.agencyId : agencyId
    const f = opts.from !== undefined ? opts.from : from
    const t = opts.to !== undefined ? opts.to : to
    setLoading(true); setError('')
    const params = {}
    if (aid) params.agency_id = aid
    if (f) params.from = f + 'T00:00:00'
    if (t) params.to = t + 'T23:59:59'
    Promise.all([getReportsSummary(params), getPlayLog(params)])
      .then(([sumData, logData]) => {
        setSummary(sumData); setLogs(logData)
        if (sumData.global.total_plays === 0) setError('Niciun rezultat pentru filtrele selectate.')
      })
      .catch(e => { setSummary(null); setLogs([]); setError('Eroare la încărcare: ' + (e?.message || 'unknown')) })
      .finally(() => setLoading(false))

    const _dn = new Date()
    const _todayLocal = `${_dn.getFullYear()}-${String(_dn.getMonth()+1).padStart(2,'0')}-${String(_dn.getDate()).padStart(2,'0')}`
    const singleDay = f && t && f === t ? f : (!f && !t ? _todayLocal : null)
    if (singleDay) {
      setUptimeLoading(true)
      const targetAgencies = aid ? agencies.filter(a => String(a.id) === String(aid)) : agencies
      Promise.all(
        targetAgencies.flatMap(a =>
          (a.tvs || []).map(tv =>
            getUptimeReport(a.id, tv.label, singleDay)
              .then(d => ({ key: `${a.id}:${tv.label}`, data: d }))
              .catch(() => null)
          )
        )
      ).then(results => {
        const map = {}
        results.filter(Boolean).forEach(r => { map[r.key] = r.data })
        setUptimeData(map)
      }).finally(() => setUptimeLoading(false))
    } else { setUptimeData({}) }
  }

  useEffect(() => {
    if (!hasFiltered) return
    setNextRefresh(60)
    const tick = setInterval(() => setNextRefresh(n => n - 1), 1000)
    const refresh = setInterval(() => { load(); setNextRefresh(60) }, 60_000)
    return () => { clearInterval(tick); clearInterval(refresh) }
  }, [agencyId, from, to, hasFiltered])

  const _d = new Date()
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

  const periodStart = from ? new Date(from + 'T00:00:00') : null
  const periodEnd = to ? new Date(to + 'T23:59:59') : null
  const periodSeconds = (periodStart && periodEnd) ? Math.round((periodEnd - periodStart) / 1000) : null

  const totalDuration = summary?.global?.total_seconds ?? 0
  const totalPlays = summary?.global?.total_plays ?? 0
  const uniqueFiles = summary?.global?.unique_files ?? 0

  const fileDurationSums = {}, fileDurationCounts = {}
  logs.forEach(r => {
    if (r.duration_seconds > 0) {
      fileDurationSums[r.filename] = (fileDurationSums[r.filename] || 0) + r.duration_seconds
      fileDurationCounts[r.filename] = (fileDurationCounts[r.filename] || 0) + 1
    }
  })
  const avgDurations = {}
  Object.keys(fileDurationSums).forEach(f => { avgDurations[f] = Math.round(fileDurationSums[f] / fileDurationCounts[f]) })

  const agencyMap = {}
  agencies.forEach(a => { agencyMap[a.id] = a })

  const byAgency = {}
  ;(summary?.byAgency ?? []).forEach(r => { byAgency[r.agency_id] = { plays: r.plays, total: r.total_seconds } })

  const fileStats = (summary?.byFile ?? []).map(r => ({
    name: r.original_name, filename: r.filename, type: r.media_type, plays: r.plays, total: r.total_seconds,
  }))
  const maxTotal = fileStats[0]?.total || 1

  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'var(--shadow-sm)' }
  const inp = { height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:8,
    background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none' }

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:22, color:'var(--fg)', margin:0 }}>
            Proof of Play
          </h1>
          <p style={{ fontSize:13, color:'var(--fg-3)', marginTop:3 }}>
            Istoric redare pe fiecare ecran
            {hasFiltered && <span style={{ marginLeft:8, color:'var(--fg-3)' }}>· actualizare în {nextRefresh}s</span>}
          </p>
        </div>
        <button onClick={() => downloadExcel(summary, logs, agencies, playlists, avgDurations)} disabled={!summary}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 14px',
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
            fontSize:13, fontWeight:500, color:'var(--fg-2)', cursor:'pointer', boxShadow:'var(--shadow-sm)',
            opacity:!summary?.4:1 }}>
          ↓ Export Excel
        </button>
      </div>

      {/* Filters */}
      <div style={{ ...card, padding:'14px 16px', marginBottom:20, display:'flex', alignItems:'flex-end', gap:14, flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:11, color:'var(--fg-3)', fontWeight:600, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>Agenție</label>
          <select value={agencyId} onChange={e => setAgencyId(e.target.value)}
            style={{ ...inp, minWidth:180 }}>
            <option value="">Toate agențiile</option>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name} · {a.city}</option>)}
          </select>
        </div>
        {[{label:'De la', ref:fromRef, val:from, set:setFrom},{label:'Până la', ref:toRef, val:to, set:setTo}].map(f => (
          <div key={f.label}>
            <label style={{ fontSize:11, color:'var(--fg-3)', fontWeight:600, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'.05em' }}>{f.label}</label>
            <div style={{ position:'relative', cursor:'pointer' }} onClick={() => f.ref.current?.showPicker?.() ?? f.ref.current?.click()}>
              <input ref={f.ref} type="date" value={f.val} max={today} onChange={e => f.set(e.target.value)}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer' }} />
              <div style={{ ...inp, minWidth:160, display:'flex', alignItems:'center', userSelect:'none' }}>
                {fmtDateDisplay(f.val)}
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => { setHasFiltered(true); load() }} disabled={loading}
          style={{ height:36, padding:'0 18px', background:'var(--accent)', color:'#fff',
            border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:loading?.6:1 }}>
          {loading ? 'Se încarcă...' : 'Filtrează'}
        </button>
        {(agencyId || from || to) && (
          <button onClick={() => { setAgencyId(''); setFrom(''); setTo(''); setHasFiltered(false); setSummary(null); setLogs([]) }}
            style={{ fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
            Resetează
          </button>
        )}
      </div>

      {error && hasFiltered && (
        <div style={{ marginBottom:16, padding:'10px 14px', background:'rgba(251,191,36,.1)',
          border:'1px solid rgba(251,191,36,.3)', borderRadius:8, fontSize:13, color:'#B45309' }}>
          {error}
        </div>
      )}

      {/* Summary tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        {[
          { label:'Total redări', val: summary ? String(totalPlays) : '—', color:'var(--fg)' },
          { label:'Durată totală rulată', val: summary ? fmtDurationLong(totalDuration) : '—', color:'var(--accent)' },
          { label:'Fișiere unice', val: summary ? String(uniqueFiles) : '—', color:'var(--fg)' },
        ].map(t => (
          <div key={t.label} style={{ ...card, padding:'18px 22px' }}>
            <p style={{ fontSize:11, color:'var(--fg-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', margin:0 }}>{t.label}</p>
            <p style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:30, color:t.color, margin:'6px 0 0' }}>{t.val}</p>
          </div>
        ))}
      </div>

      {/* Uptime per TV */}
      {(Object.keys(uptimeData).length > 0 || uptimeLoading) && (
        <div style={{ marginBottom:20 }}>
          <h3 style={{ fontSize:13.5, fontWeight:700, color:'var(--fg)', marginBottom:12 }}>
            Funcționare TV pe zi
            {uptimeLoading && <span style={{ marginLeft:8, fontWeight:400, color:'var(--fg-3)' }}>Se încarcă...</span>}
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
            {Object.entries(uptimeData).map(([key, d]) => {
              const [agId, ...tvParts] = key.split(':')
              const tvLabel = tvParts.join(':')
              const agency = agencyMap[agId]
              const total = d.total_online_seconds + d.total_offline_seconds
              const pct = total > 0 ? Math.round((d.total_online_seconds / total) * 100) : 0
              return (
                <div key={key} style={{ ...card, padding:18 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <p style={{ fontWeight:700, fontSize:14, color:'var(--fg)', margin:0 }}>{agency?.name ?? `#${agId}`}</p>
                      <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2 }}>{tvLabel}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {d.no_data
                        ? <p style={{ fontSize:12, color:'#DC2626', fontWeight:600 }}>❌ offline</p>
                        : <>
                          <p style={{ fontSize:12, color:'#059669', fontWeight:600 }}>✅ {d.total_online_formatted} online</p>
                          {d.total_offline_seconds > 0 && <p style={{ fontSize:12, color:'#DC2626', fontWeight:600 }}>❌ {d.total_offline_formatted} offline</p>}
                        </>
                      }
                    </div>
                  </div>
                  {!d.no_data && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11.5, color:'var(--fg-3)' }}>Uptime</span>
                        <span style={{ fontSize:12, fontWeight:700, color: pct>=90?'#059669':pct>=50?'#D97706':'#DC2626' }}>{pct}%</span>
                      </div>
                      <div style={{ height:6, background:'rgba(239,68,68,.12)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:6, borderRadius:99, width:`${pct}%`,
                          background: pct>=90?'#10B981':pct>=50?'#F59E0B':'#EF4444' }} />
                      </div>
                    </div>
                  )}
                  {d.no_data && <p style={{ fontSize:12, color:'#DC2626', fontWeight:600 }}>❌ Offline toată ziua</p>}
                  {!d.no_data && d.offline_periods.length === 0
                    ? <p style={{ fontSize:12, color:'#059669' }}>✓ Nicio perioadă de nefuncționare înregistrată.</p>
                    : !d.no_data && (
                      <div>
                        <p style={{ fontSize:11.5, color:'var(--fg-3)', fontWeight:600, marginBottom:6 }}>Perioade nefuncționare:</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {d.offline_periods.map((p, i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12,
                              background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.12)', borderRadius:6, padding:'4px 10px' }}>
                              <span style={{ color:'#DC2626', fontWeight:600 }}>{p.from} – {p.to}</span>
                              <span style={{ color:'#F87171' }}>{p.duration_formatted}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Playlist cycles per agency */}
      {Object.keys(byAgency).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <h3 style={{ fontSize:13.5, fontWeight:700, color:'var(--fg)', marginBottom:12 }}>Cicluri playlist per agenție</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
            {Object.entries(byAgency).map(([agId, data]) => {
              const agency = agencyMap[agId]
              const items = playlists[agId] || []
              const pd = playlistDuration(items, avgDurations)
              const cycles = pd > 0 ? Math.floor(data.total / pd) : null
              const remainder = pd > 0 ? data.total % pd : 0
              const expectedCycles = (pd > 0 && periodSeconds) ? Math.floor(periodSeconds / pd) : null
              const uptime = expectedCycles ? Math.min(100, Math.round((cycles / expectedCycles) * 100)) : null
              return (
                <div key={agId} style={{ ...card, padding:18 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <p style={{ fontWeight:700, fontSize:14, color:'var(--fg)', margin:0 }}>{agency?.name ?? `Agenție #${agId}`}</p>
                      <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2 }}>{agency?.city}</p>
                    </div>
                    {pd > 0 && (
                      <span style={{ fontSize:11.5, background:'var(--surface-2)', color:'var(--fg-3)',
                        padding:'3px 8px', borderRadius:6, fontFamily:'monospace', border:'1px solid var(--border)' }}>
                        playlist {fmtDurationLong(pd)}
                      </span>
                    )}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                    {[
                      { val: cycles ?? '—', label:'cicluri complete', color:'var(--accent)' },
                      { val: fmtDurationLong(data.total), label:'timp rulat', color:'var(--fg)' },
                      { val: data.plays, label:'redări fișiere', color:'var(--fg)' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign:'center' }}>
                        <p style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:22,
                          color:s.color, margin:0 }}>{s.val}</p>
                        <p style={{ fontSize:11, color:'var(--fg-3)', marginTop:3 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {remainder > 0 && (
                    <p style={{ fontSize:12, color:'var(--fg-3)', marginBottom:10 }}>
                      + {fmtDurationLong(remainder)} din ciclul curent (nefinalizat)
                    </p>
                  )}
                  {uptime !== null && (
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11.5, color:'var(--fg-3)' }}>Uptime față de așteptat ({expectedCycles} cicluri)</span>
                        <span style={{ fontSize:12, fontWeight:700, color: uptime>=90?'#059669':uptime>=50?'#D97706':'#DC2626' }}>{uptime}%</span>
                      </div>
                      <div style={{ height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:6, borderRadius:99, transition:'width .3s', width:`${uptime}%`,
                          background: uptime>=90?'#10B981':uptime>=50?'#F59E0B':'#EF4444' }} />
                      </div>
                    </div>
                  )}
                  {items.length === 0 && <p style={{ fontSize:12, color:'#D97706' }}>Playlist gol — nu se poate calcula cicluri</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ ...card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ fontSize:13.5, fontWeight:700, color:'var(--fg)', margin:0 }}>Timp de rulare per fișier</h3>
          </div>
          <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            {fileStats.length === 0 && <p style={{ fontSize:13, color:'var(--fg-3)', textAlign:'center', padding:'20px 0' }}>Nicio înregistrare</p>}
            {fileStats.map(f => (
              <div key={f.name}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'1px 6px', borderRadius:5, flexShrink:0,
                      background: f.type==='video' ? 'rgba(124,58,237,.1)' : 'rgba(37,99,235,.08)',
                      color: f.type==='video' ? '#7C3AED' : 'var(--accent)' }}>
                      {f.type === 'video' ? '▶' : '🖼'}
                    </span>
                    <span style={{ fontSize:13, color:'var(--fg-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0, marginLeft:12 }}>
                    <span style={{ fontSize:12, color:'var(--fg-3)' }}>{f.plays}×</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--fg)', fontVariantNumeric:'tabular-nums', width:64, textAlign:'right' }}>{fmtDurationLong(f.total)}</span>
                  </div>
                </div>
                <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:5, borderRadius:99,
                    background: f.type==='video' ? '#A78BFA' : '#93C5FD',
                    width:`${Math.round((f.total/maxTotal)*100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ fontSize:13.5, fontWeight:700, color:'var(--fg)', margin:0 }}>Per agenție</h3>
          </div>
          <div>
            {Object.entries(byAgency).length === 0 && (
              <p style={{ fontSize:13, color:'var(--fg-3)', textAlign:'center', padding:'28px 0' }}>Nicio înregistrare</p>
            )}
            {Object.entries(byAgency).sort((a,b) => b[1].total - a[1].total).map(([id, data]) => (
              <div key={id} style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--fg)', margin:0 }}>{agencyMap[id]?.name ?? `#${id}`}</p>
                  <p style={{ fontSize:11.5, color:'var(--fg-3)', marginTop:1 }}>{data.plays} redări</p>
                </div>
                <span style={{ fontSize:13.5, fontWeight:800, color:'var(--accent)', fontFamily:'Plus Jakarta Sans, sans-serif', fontVariantNumeric:'tabular-nums' }}>
                  {fmtDurationLong(data.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow:'hidden' }}>
        <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--fg)', margin:0 }}>
            {loading ? 'Se încarcă...' : `${logs.length} înregistrări recente${totalPlays > logs.length ? ` (din ${totalPlays} total)` : ''}`}
          </h3>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--surface-2)' }}>
                {['Data / Ora', 'Agenție', 'TV', 'Fișier', 'Tip', 'Durată'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'10px 20px', fontSize:11, fontWeight:700,
                    color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ padding:'40px 20px', textAlign:'center', color:'var(--fg-3)', fontSize:13 }}>
                  Nicio înregistrare. Playerul raportează automat după ce fiecare fișier se termină.
                </td></tr>
              )}
              {logs.map((r, i) => (
                <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background: i%2===0 ? 'transparent' : 'var(--surface-2)' }}>
                  <td style={{ padding:'10px 20px', color:'var(--fg-3)', whiteSpace:'nowrap' }}>{fmt(r.played_at)}</td>
                  <td style={{ padding:'10px 20px', color:'var(--fg-2)' }}>{agencyMap[r.agency_id]?.name ?? `#${r.agency_id}`}</td>
                  <td style={{ padding:'10px 20px', fontWeight:600, color:'var(--fg)' }}>{r.tv_label}</td>
                  <td style={{ padding:'10px 20px', color:'var(--fg-2)', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.original_name}>{r.original_name}</td>
                  <td style={{ padding:'10px 20px' }}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, fontWeight:600,
                      padding:'2px 8px', borderRadius:99,
                      background: r.media_type==='video' ? 'rgba(124,58,237,.1)' : 'rgba(37,99,235,.08)',
                      color: r.media_type==='video' ? '#7C3AED' : 'var(--accent)' }}>
                      {r.media_type === 'video' ? '▶ video' : '🖼 imagine'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 20px', color:'var(--fg-3)', fontVariantNumeric:'tabular-nums' }}>{fmtDuration(r.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
