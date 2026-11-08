import { useState, useEffect } from 'react'
import { getAgencies, getGroups, updateTvAnydesk, getDiagnostics } from '../api'

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

function formatLastSeen(dateStr) {
  if (!dateStr) return { line1: 'Niciodată', line2: null }
  const date = new Date(dateStr + 'Z')
  const diff = Date.now() - date.getTime()
  const line2 = date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  if (diff < 60_000) return { line1: 'Acum', line2 }
  if (diff < 3_600_000) return { line1: `${Math.round(diff / 60_000)} min`, line2 }
  if (diff < 86_400_000) return { line1: `${Math.round(diff / 3_600_000)} ore`, line2 }
  return { line1: `${Math.round(diff / 86_400_000)} zile`, line2 }
}

function formatUptime(seconds) {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ore`
  return `${Math.floor(seconds / 86400)} zile`
}

const S = {
  chip: (bg, color) => ({ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600, background:bg, color }),
  th: { padding:'9px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', background:'var(--surface-2)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
  td: { padding:'10px 14px', borderBottom:'1px solid var(--border)', color:'var(--fg-2)', verticalAlign:'middle' },
}

export default function TVs() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [anydeskEdit, setAnydeskEdit] = useState({})
  const [anydeskSaving, setAnydeskSaving] = useState({})
  const [diagCache, setDiagCache] = useState({})

  const load = () =>
    Promise.all([getAgencies(), getGroups()]).then(([agencies, groups]) => {
      const groupMap = {}
      const groupHasPlaylist = {}
      groups.forEach(g => {
        g.agencies.forEach(a => { groupMap[a.id] = g.name })
        groupHasPlaylist[g.name] = (g.playlist?.length ?? 0) > 0
      })
      const all = agencies.flatMap(a => {
        const group_name = groupMap[a.id] || null
        const playlist_count = a.playlist?.length ?? 0
        const has_content = group_name ? (groupHasPlaylist[group_name] ?? false) : playlist_count > 0
        return a.tvs.map(tv => ({ ...tv, agency_id: a.id, agency_name: a.name, city: a.city, group_name, playlist_count, has_content }))
      })
      const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      all.sort((a, b) => norm(a.agency_name).localeCompare(norm(b.agency_name)) || norm(a.label).localeCompare(norm(b.label)))
      setRows(all)
    })

  useEffect(() => { load(); const i = setInterval(load, 15_000); return () => clearInterval(i) }, [])

  const online = rows.filter(isOnline).length
  const offline = rows.length - online
  const noContent = rows.filter(r => !r.has_content).length

  const q = search.toLowerCase()
  const filtered = rows
    .filter(tv => {
      if (filter === 'online') return isOnline(tv)
      if (filter === 'offline') return !isOnline(tv)
      if (filter === 'no_content') return !tv.has_content
      return true
    })
    .filter(tv => !q || tv.label.toLowerCase().includes(q) || tv.agency_name.toLowerCase().includes(q) || (tv.city || '').toLowerCase().includes(q) || (tv.group_name || '').toLowerCase().includes(q))

  async function saveAnydesk(tv) {
    const val = anydeskEdit[tv.id] ?? tv.anydesk_id ?? ''
    setAnydeskSaving(s => ({ ...s, [tv.id]: true }))
    try {
      await updateTvAnydesk(tv.id, val)
      setRows(prev => prev.map(r => r.id === tv.id ? { ...r, anydesk_id: val || null } : r))
    } catch { alert('Eroare la salvare.') }
    finally { setAnydeskSaving(s => ({ ...s, [tv.id]: false })) }
  }

  const filters = [
    { key: 'all',        label: `Toate (${rows.length})`,         accent: 'var(--fg-3)' },
    { key: 'online',     label: `Online (${online})`,             accent: '#10B981' },
    { key: 'offline',    label: `Offline (${offline})`,           accent: '#EF4444' },
    { key: 'no_content', label: `Fără conținut (${noContent})`,   accent: '#F59E0B' },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, system-ui, sans-serif', fontSize:20, fontWeight:800, color:'var(--fg)', letterSpacing:'-.3px' }}>TV-uri</h2>
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:3 }}>Toate ecranele înregistrate · actualizat la 15s</p>
        </div>
      </div>

      {/* Filter chips + search */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:99,
              fontSize:12.5, fontWeight:600, border: filter === f.key ? `1.5px solid ${f.accent}` : '1.5px solid var(--border)',
              background: filter === f.key ? `${f.accent}15` : 'var(--surface)',
              color: filter === f.key ? f.accent : 'var(--fg-3)', cursor:'pointer', transition:'all .15s'
            }}>
            {f.key !== 'all' && <span style={{ width:7, height:7, borderRadius:'50%', background:f.accent, flexShrink:0 }} />}
            {f.label}
          </button>
        ))}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Caută TV, agenție, grup..."
          style={{ marginLeft:'auto', height:34, padding:'0 14px', border:'1px solid var(--border)', borderRadius:8,
            background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', minWidth:220 }} />
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['Status','TV / Agenție','Grup','Conținut','Orientare','Ultima activitate',''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding:'48px 14px', textAlign:'center', color:'var(--fg-3)', fontSize:13 }}>Niciun TV găsit</td></tr>
              )}
              {(() => {
                const grps = []
                filtered.forEach(tv => {
                  const last = grps[grps.length - 1]
                  if (last && last.agency_id === tv.agency_id) last.tvs.push(tv)
                  else grps.push({ agency_id: tv.agency_id, agency_name: tv.agency_name, city: tv.city, tvs: [tv] })
                })
                return grps.flatMap(g =>
                  g.tvs.flatMap((tv, tvIdx) => {
                    const on = isOnline(tv)
                    const { line1, line2 } = formatLastSeen(tv.last_seen_at)
                    const isExp = expanded === tv.id
                    const anydeskVal = anydeskEdit[tv.id] !== undefined ? anydeskEdit[tv.id] : (tv.anydesk_id ?? '')
                    const diag = diagCache[`${tv.agency_id}:${tv.label}`] || null

                    const mainRow = (
                      <tr key={tv.id} style={{ background: isExp ? 'var(--surface-2)' : 'var(--surface)' }}>
                        {/* Status */}
                        <td style={S.td}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:99, fontSize:11.5, fontWeight:600,
                            background: on ? 'var(--chip-on-bg)' : 'var(--chip-off-bg)',
                            color: on ? 'var(--chip-on-fg)' : 'var(--chip-off-fg)' }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background: on ? '#10B981' : '#EF4444', flexShrink:0 }} />
                            {on ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        {/* TV / Agenție */}
                        <td style={S.td}>
                          <div style={{ fontWeight:700, fontSize:13, color:'var(--fg)' }}>{g.agency_name}{g.city ? ` · ${g.city}` : ''}</div>
                          <div style={{ fontSize:11.5, color:'var(--fg-3)', marginTop:2 }}>
                            {tv.label}
                          </div>
                        </td>
                        {/* Grup */}
                        <td style={S.td}>
                          {tv.group_name
                            ? <span style={S.chip('rgba(124,58,237,.1)','#7C3AED')}>{tv.group_name}</span>
                            : <span style={{ color:'var(--fg-3)', fontSize:12 }}>—</span>}
                        </td>
                        {/* Conținut */}
                        <td style={S.td}>
                          {!tv.has_content
                            ? <span style={S.chip('rgba(245,158,11,.12)','#B45309')}>Fără conținut</span>
                            : tv.group_name
                              ? <span style={S.chip('rgba(124,58,237,.1)','#7C3AED')}>Din grup</span>
                              : <span style={S.chip('rgba(37,99,235,.1)','#2563EB')}>{tv.playlist_count} fișiere</span>}
                        </td>
                        {/* Orientare */}
                        <td style={S.td}>
                          <span style={S.chip(tv.orientation === 'portrait' ? 'rgba(124,58,237,.1)' : 'rgba(37,99,235,.1)', tv.orientation === 'portrait' ? '#7C3AED' : '#2563EB')}>
                            {tv.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                          </span>
                        </td>
                        {/* Ultima activitate */}
                        <td style={S.td}>
                          <div style={{ fontWeight:600, color:'var(--fg)', fontSize:13 }}>{line1}</div>
                          {line2 && <div style={{ fontSize:11, color:'var(--fg-3)', marginTop:1 }}>{line2}</div>}
                        </td>
                        {/* Acțiuni */}
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                          <button onClick={() => {
                            const next = isExp ? null : tv.id
                            setExpanded(next)
                            const diagKey = `${tv.agency_id}:${tv.label}`
                            if (next && !diagCache[diagKey]) {
                              getDiagnostics(tv.agency_id, tv.label).then(d => {
                                if (d) setDiagCache(c => ({ ...c, [diagKey]: d }))
                              }).catch(() => {})
                            }
                          }}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, height:28, padding:'0 10px', borderRadius:6, fontSize:12, fontWeight:600,
                            border:`1px solid ${isExp ? 'var(--accent)' : 'var(--border)'}`,
                            background: isExp ? 'rgba(37,99,235,.08)' : 'var(--surface-2)',
                            color: isExp ? 'var(--accent)' : 'var(--fg-3)', cursor:'pointer' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              style={{ transform: isExp ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .2s' }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )

                    const diagRow = isExp ? (
                      <tr key={`diag-${tv.id}`}>
                        <td colSpan={7} style={{ padding:'14px 18px 14px 48px', background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
                          {/* AnyDesk + IDs */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:20, marginBottom:12, fontSize:12 }}>
                            <div>
                              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', marginBottom:3 }}>TV ID</div>
                              <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--fg-2)' }}>{tv.id}</span>
                            </div>
                            <div>
                              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', marginBottom:3 }}>Agenție ID</div>
                              <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--fg-2)' }}>{tv.agency_id}</span>
                            </div>
                            <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                              <div>
                                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', marginBottom:3 }}>AnyDesk ID</div>
                                <input type="text" value={anydeskVal}
                                  onChange={e => setAnydeskEdit(s => ({ ...s, [tv.id]: e.target.value }))}
                                  placeholder="ex: 1 081 912 898"
                                  style={{ height:30, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, background:'var(--surface)', color:'var(--fg)', fontSize:12, fontFamily:'monospace', outline:'none', width:160 }} />
                              </div>
                              <button onClick={() => saveAnydesk(tv)} disabled={anydeskSaving[tv.id]}
                                style={{ height:30, padding:'0 12px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', opacity: anydeskSaving[tv.id] ? .6 : 1 }}>
                                {anydeskSaving[tv.id] ? '...' : 'Salvează'}
                              </button>
                            </div>
                          </div>
                          {/* Diagnostice */}
                          <div style={{ borderTop:'1px solid var(--border)', paddingTop:10 }}>
                            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', marginBottom:8 }}>Diagnostice Mini PC</div>
                            {diag ? (
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
                                {[
                                  { label:'CPU', val: diag.cpu != null ? `${diag.cpu}%` : '—' },
                                  { label:'RAM liber', val: diag.ramFreeGB != null ? `${diag.ramFreeGB} GB${diag.ramTotalGB ? ` / ${diag.ramTotalGB} GB` : ''}` : '—' },
                                  { label:'WiFi', val: diag.wifiSsid ? `${diag.wifiSsid}${diag.wifiSignal != null ? ` (${diag.wifiSignal}%)` : ''}` : '—' },
                                  { label:'Edge', val: diag.edgeRunning == null ? '—' : diag.edgeRunning ? 'Rulează' : 'Oprit' },
                                  { label:'Uptime', val: diag.uptimeSeconds != null ? formatUptime(diag.uptimeSeconds) : '—' },
                                ].map(({ label, val }) => (
                                  <div key={label}>
                                    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px', color:'var(--fg-3)', marginBottom:2 }}>{label}</div>
                                    <div style={{ fontSize:13, fontWeight:600, color:'var(--fg)' }}>{val}</div>
                                  </div>
                                ))}
                                {diag.receivedAt && (
                                  <div style={{ fontSize:11, color:'var(--fg-3)', alignSelf:'flex-end' }}>
                                    Actualizat: {new Date(diag.receivedAt).toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p style={{ fontSize:12, color:'var(--fg-3)', fontStyle:'italic' }}>Date indisponibile — mini PC-ul nu a trimis diagnostice încă.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null

                    return [mainRow, diagRow].filter(Boolean)
                  })
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > 0 && (
        <p style={{ fontSize:11.5, color:'var(--fg-3)', textAlign:'right', marginTop:10 }}>
          {filtered.length} TV{filtered.length !== 1 ? '-uri' : ''} afișate
        </p>
      )}
    </div>
  )
}
