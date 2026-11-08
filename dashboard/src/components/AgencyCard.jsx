import { useState, useEffect, useRef } from 'react'
import PlaylistModal from './PlaylistModal'
import PreviewPlayer from './PreviewPlayer'
import { addTv, deleteTv, deleteAgency, updateTvOrientation, renameAgency, updateAgencySettings, getPlaylist } from '../api'

function tvStatus(tv) {
  if (!tv.last_seen_at) return { online: false, label: 'Niciodată', detail: '' }
  const date = new Date(tv.last_seen_at + 'Z')
  const diff = Date.now() - date.getTime()
  const pad = n => String(n).padStart(2, '0')
  const detail = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (diff < 60_000) return { online: true, label: 'Online', detail }
  const mins = Math.round(diff / 60_000)
  const timeLabel = mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h ${mins % 60}min`
  return { online: false, label: timeLabel, detail }
}

const SERVER_ORIGIN = window.location.origin

function playerUrl(agencyId, tvLabel) {
  return `${SERVER_ORIGIN}/player/?agencyId=${agencyId}&tvId=${encodeURIComponent('__preview__' + tvLabel)}&preview=1`
}

function isSpecialTv(tvLabel) {
  const l = tvLabel.toLowerCase()
  return l.includes('schimb valutar') || l.includes('info obligatorii')
}

export default function AgencyCard({ agency, groupName, onPlaylistSaved, onDeleted }) {
  const [showModal, setShowModal] = useState(false)
  const [showTvPicker, setShowTvPicker] = useState(false)
  const pickerRef = useRef(null)
  const [addingTv, setAddingTv] = useState(false)
  const [tvLabel, setTvLabel] = useState('')
  const [tvOrientation, setTvOrientation] = useState('landscape')
  const [tvError, setTvError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState(agency.name)
  const [editCity, setEditCity] = useState(agency.city)
  const [editAddress, setEditAddress] = useState(agency.address || '')
  const [renameError, setRenameError] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [showAgencyName, setShowAgencyName] = useState(agency.show_agency_name !== 0)
  const [showPlayerLabel, setShowPlayerLabel] = useState(agency.show_player_label === 1)
  const [previewItems, setPreviewItems] = useState(null)
  const [previewPortrait, setPreviewPortrait] = useState(false)
  const [previewMode, setPreviewMode] = useState('playlist')

  useEffect(() => {
    if (!showTvPicker) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowTvPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTvPicker])


  const handleSetting = async (key, value) => {
    const next = { show_agency_name: showAgencyName, show_player_label: showPlayerLabel, [key]: value }
    if (key === 'show_agency_name') setShowAgencyName(value)
    if (key === 'show_player_label') setShowPlayerLabel(value)
    try { await updateAgencySettings(agency.id, next) } catch {}
  }

  const handleRename = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    setRenaming(true)
    try {
      await renameAgency(agency.id, editName.trim(), editCity.trim(), editAddress.trim())
      setEditingName(false)
      setRenameError('')
      onPlaylistSaved()
    } catch (err) {
      setRenameError(err?.response?.data?.error || 'Eroare la redenumire.')
    }
    setRenaming(false)
  }

  const handleAddTv = async (e) => {
    e.preventDefault()
    setTvError('')
    if (!tvLabel.trim()) return setTvError('Introdu un nume pentru TV.')
    try {
      await addTv(agency.id, tvLabel.trim(), tvOrientation)
      setTvLabel('')
      setTvOrientation('landscape')
      setAddingTv(false)
      onPlaylistSaved()
    } catch { setTvError('Eroare la adăugare TV.') }
  }

  const handleToggleOrientation = async (tv) => {
    const { online } = tvStatus(tv)
    if (online && !confirm(`"${tv.label}" este online. Ești sigur că vrei să schimbi orientarea?`)) return
    const next = tv.orientation === 'portrait' ? 'landscape' : 'portrait'
    try { await updateTvOrientation(agency.id, tv.id, next); onPlaylistSaved() } catch {}
  }

  const handleDeleteTv = async (tv) => {
    const { online } = tvStatus(tv)
    if (online) return alert('Nu poți șterge un TV care e online.')
    if (!confirm(`Ștergi ${tv.label}?`)) return
    await deleteTv(tv.id)
    onPlaylistSaved()
  }

  const handleDeleteAgency = async () => {
    if (!confirm(`Ștergi agenția "${agency.name}" și toate TV-urile și playlistul ei?`)) return
    await deleteAgency(agency.id)
    onDeleted()
  }

  const handlePreview = async (tvLabel) => {
    setShowTvPicker(false)
    const tv = agency.tvs?.find(t => t.label === tvLabel)
    const isPortrait = tv?.orientation === 'portrait'
    if (isSpecialTv(tvLabel)) {
      const isForex = tvLabel.toLowerCase().includes('schimb valutar')
      setPreviewPortrait(isPortrait)
      setPreviewMode(isForex ? 'forex' : 'info')
      setPreviewItems([])
      return
    }
    try {
      const items = await getPlaylist(agency.id)
      setPreviewPortrait(isPortrait)
      setPreviewMode('playlist')
      setPreviewItems(items)
    } catch {}
  }

  const inp = (w) => ({ height:30, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6,
    background:'var(--surface)', color:'var(--fg)', fontSize:12, outline:'none', width: w || '100%' })
  const btn = (bg, color, border) => ({ display:'inline-flex', alignItems:'center', gap:5, height:28, padding:'0 10px',
    borderRadius:6, background:bg, color, border: border || 'none', fontSize:12, fontWeight:600, cursor:'pointer' })

  return (
    <>
    {previewItems !== null && (
      <PreviewPlayer items={previewItems} portrait={previewPortrait} mode={previewMode}
        agencyId={agency.id} onClose={() => setPreviewItems(null)} />
    )}
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
      {/* Card header */}
      <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <div style={{ flex:1 }}>
            {editingName ? (
              <form onSubmit={handleRename} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <input autoFocus value={editName} onChange={e => { setEditName(e.target.value); setRenameError('') }}
                    placeholder="Nume agenție" style={{ ...inp(180), fontWeight:700 }} />
                  <input value={editCity} onChange={e => setEditCity(e.target.value)}
                    placeholder="Oraș" style={inp(110)} />
                  <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                    placeholder="Adresă (ex: Str. Victoriei 10)" style={inp(240)} />
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button type="submit" disabled={renaming} style={{ ...btn('var(--accent)', '#fff'), opacity:renaming?.6:1 }}>
                    {renaming ? 'Se caută...' : 'Salvează'}
                  </button>
                  <button type="button" onClick={() => { setEditingName(false); setEditName(agency.name); setEditCity(agency.city); setEditAddress(agency.address || ''); setRenameError('') }}
                    style={{ fontSize:12, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>Anulează</button>
                  {renameError && <span style={{ fontSize:11.5, color:'#DC2626' }}>{renameError}</span>}
                </div>
              </form>
            ) : (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:14.5, color:'var(--fg)' }}>{agency.name}</span>
                  <span style={{ fontSize:10, fontFamily:'monospace', background:'var(--surface-2)', color:'var(--fg-3)', padding:'2px 6px', borderRadius:4, border:'1px solid var(--border)' }}>ID:{agency.id}</span>
                  <button onClick={() => { setEditingName(true); setEditName(agency.name); setEditCity(agency.city) }}
                    style={{ fontSize:11, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }} title="Redenumește">✏️</button>
                </div>
                <div style={{ fontSize:11.5, color:'var(--fg-3)', marginTop:2 }}>
                  {agency.city}{agency.address ? ` · ${agency.address}` : ''}
                </div>
                {groupName && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:5, fontSize:11.5, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'rgba(124,58,237,.1)', color:'#7C3AED' }}>
                    Grup: {groupName}
                  </span>
                )}
                <div style={{ display:'flex', gap:12, marginTop:8 }}>
                  {[
                    { key:'show_agency_name', val:showAgencyName, label:'Afișează numele agenției pe TV' },
                    { key:'show_player_label', val:showPlayerLabel, label:'Afișează eticheta Player' },
                  ].map(({ key, val, label }) => (
                    <label key={key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--fg-3)', cursor:'pointer' }}>
                      <input type="checkbox" checked={val} onChange={e => handleSetting(key, e.target.checked)}
                        style={{ accentColor:'var(--accent)', width:13, height:13 }} />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            {agency.tvs?.length > 0 && (
              <div style={{ position:'relative' }} ref={pickerRef}>
                <button onClick={() => {
                    if (agency.tvs.length === 1) handlePreview(agency.tvs[0].label)
                    else setShowTvPicker(v => !v)
                  }}
                  style={{ ...btn('#2563EB', '#fff'), gap:4 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Preview
                  {agency.tvs.length > 1 && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>}
                </button>
                {showTvPicker && agency.tvs.length > 1 && (
                  <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', zIndex:50, minWidth:160, padding:'4px 0' }}>
                    {agency.tvs.map(tv => (
                      <button key={tv.id} onClick={() => handlePreview(tv.label)}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 12px', fontSize:12.5, color:'var(--fg-2)', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                        {tv.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!groupName && (
              <button onClick={() => setShowModal(true)}
                style={btn('var(--surface-2)', 'var(--accent)', '1px solid var(--border)')}>
                Playlist
              </button>
            )}
            <button onClick={handleDeleteAgency}
              style={btn('rgba(239,68,68,.07)', '#DC2626', '1px solid rgba(239,68,68,.15)')}>
              Șterge
            </button>
          </div>
        </div>
      </div>

      {/* TV chips */}
      <div style={{ padding:'10px 16px', display:'flex', flexWrap:'wrap', gap:6, borderBottom:'1px solid var(--border)' }}>
        {agency.tvs.length === 0 && (
          <span style={{ fontSize:12, color:'var(--fg-3)' }}>Niciun TV adăugat.</span>
        )}
        {agency.tvs.map(tv => {
          const { online, label } = tvStatus(tv)
          const isPortrait = tv.orientation === 'portrait'
          return (
            <span key={tv.id} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:7,
              fontSize:12, fontWeight:500, border:'1px solid var(--border)',
              background: online ? 'var(--chip-on-bg)' : 'var(--chip-off-bg)',
              color: online ? 'var(--chip-on-fg)' : 'var(--chip-off-fg)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background: online ? '#10B981' : '#EF4444', flexShrink:0 }} />
              {tv.label} — {label}
              <button onClick={() => handleToggleOrientation(tv)} title={`Orientare: ${isPortrait ? 'Portret' : 'Peisaj'}`}
                style={{ fontSize:9.5, fontWeight:700, padding:'1px 5px', borderRadius:4, cursor:'pointer', border:'none',
                  background: isPortrait ? 'rgba(124,58,237,.15)' : 'rgba(37,99,235,.12)',
                  color: isPortrait ? '#7C3AED' : '#2563EB' }}>
                {isPortrait ? 'PORT.' : 'LAND.'}
              </button>
              {!online && (
                <button onClick={() => handleDeleteTv(tv)}
                  style={{ fontSize:11, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer', lineHeight:1 }}>✕</button>
              )}
            </span>
          )
        })}
        <button onClick={() => setAddingTv(v => !v)}
          style={{ fontSize:12, fontWeight:600, color:'var(--accent)', background:'none', border:'1.5px dashed var(--border)', padding:'3px 10px', borderRadius:99, cursor:'pointer' }}>
          + TV
        </button>
      </div>

      {/* Add TV form */}
      {addingTv && (
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
          <form onSubmit={handleAddTv} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <input value={tvLabel} onChange={e => setTvLabel(e.target.value)}
              placeholder='ex: "TV-Vitrina-1"'
              style={{ ...inp(180) }} />
            <div style={{ display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid var(--border)' }}>
              {['landscape','portrait'].map(orient => (
                <button key={orient} type="button" onClick={() => setTvOrientation(orient)}
                  style={{ padding:'0 10px', height:30, fontSize:11.5, fontWeight:600, border:'none', cursor:'pointer',
                    background: tvOrientation === orient ? 'var(--accent)' : 'var(--surface)',
                    color: tvOrientation === orient ? '#fff' : 'var(--fg-2)' }}>
                  {orient === 'landscape' ? '▭ Peisaj' : '▯ Portret'}
                </button>
              ))}
            </div>
            <button type="submit" style={btn('var(--accent)', '#fff')}>Adaugă</button>
            <button type="button" onClick={() => setAddingTv(false)}
              style={{ fontSize:12, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>Anulează</button>
          </form>
          {tvError && <p style={{ fontSize:11.5, color:'#DC2626', marginTop:4 }}>{tvError}</p>}
        </div>
      )}

      {/* Playlist items preview */}
      {!groupName && (
        <div style={{ padding:'10px 16px', display:'flex', flexWrap:'wrap', gap:5 }}>
          {(agency.playlist?.length === 0 || !agency.playlist) && (
            <span style={{ fontSize:12, color:'var(--fg-3)' }}>Niciun conținut asignat.</span>
          )}
          {agency.playlist?.map((item, i) => (
            <span key={i} style={{ fontSize:11.5, fontWeight:500, padding:'2px 8px', borderRadius:6,
              background:'rgba(37,99,235,.08)', color:'var(--accent)', border:'1px solid rgba(37,99,235,.12)' }}>
              {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
            </span>
          ))}
        </div>
      )}

      {showModal && (
        <PlaylistModal
          agency={agency}
          current={agency.playlist?.map(p => ({ ...p, id: p.id })) || []}
          onClose={() => setShowModal(false)}
          onSaved={onPlaylistSaved}
        />
      )}
    </div>
    </>
  )
}
