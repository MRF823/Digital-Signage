import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getAgencies, getGroups, getMedia, mediaUrl } from '../api'
import PreviewPlayer from '../components/PreviewPlayer'

function DateInput({ value, onChange, min }) {
  const ref = useRef()
  const [focused, setFocused] = useState(false)
  const showPlaceholder = !value && !focused
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        style={showPlaceholder ? { color: 'transparent' } : {}}
      />
      {showPlaceholder && (
        <span
          onClick={() => ref.current?.showPicker?.() || ref.current?.focus()}
          className="absolute inset-0 flex items-center px-3 text-sm text-gray-400 pointer-events-auto cursor-text select-none"
        >
          --/--/----
        </span>
      )}
    </div>
  )
}

function SortableItem({ item, onRemove, onUpdateDuration }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2 shadow-sm">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400">⠿</span>
      <span className="text-lg">{item.type === 'video' ? '🎬' : '🖼️'}</span>
      <span className="text-sm flex-1 truncate">{item.original_name}</span>
      {item.type === 'image' && (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number" min="1" max="300"
            value={item.display_duration_seconds ?? 10}
            onChange={e => onUpdateDuration(item.id, parseInt(e.target.value, 10) || 10)}
            className="w-14 text-xs border rounded px-1.5 py-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-400">sec</span>
        </div>
      )}
      <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
    </div>
  )
}

function CampaignPlaylistModal({ title, initialItems, onSave, onClose }) {
  const [allMedia, setAllMedia] = useState([])
  const [items, setItems] = useState(initialItems)
  const [previewing, setPreviewing] = useState(false)
  const [quickPreview, setQuickPreview] = useState(null)

  useEffect(() => { getMedia().then(setAllMedia) }, [])

  const addItem = (m) => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random()}`,
      media_id: m.id,
      filename: m.filename,
      original_name: m.original_name,
      type: m.type,
      display_duration_seconds: m.type === 'image' ? 10 : null,
    }])
  }

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

  const updateDuration = (id, seconds) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, display_duration_seconds: seconds } : i))
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setItems(prev => {
      const from = prev.findIndex(i => i.id === active.id)
      const to = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  const inPlaylistCount = items.reduce((acc, i) => { acc[i.media_id] = (acc[i.media_id] || 0) + 1; return acc }, {})

  const enrichedItems = items.map(item => {
    const m = allMedia.find(x => x.id === item.media_id)
    return { ...item, filename: item.filename || m?.filename }
  })

  return (
    <>
      {previewing && enrichedItems.length > 0 && (
        <PreviewPlayer items={enrichedItems} onClose={() => setPreviewing(false)} />
      )}
      {quickPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70]" onClick={() => setQuickPreview(null)}>
          <div className="relative max-w-3xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickPreview(null)} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">✕</button>
            {quickPreview.type === 'video'
              ? <video src={mediaUrl(quickPreview.filename)} controls autoPlay onLoadedMetadata={e => e.target.style.opacity=1} className="w-full rounded-lg max-h-[75vh]" style={{opacity:0,transition:'opacity 0.2s'}} />
              : <img src={mediaUrl(quickPreview.filename)} alt={quickPreview.original_name} className="w-full rounded-lg max-h-[75vh] object-contain" />
            }
            <p className="text-white text-sm text-center mt-3 opacity-70">{quickPreview.original_name}</p>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="font-bold text-gray-800">Playlist campanie</h3>
              <p className="text-xs text-gray-400">{title}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto border-r">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Playlist (trage pentru reordonare)</p>
              {items.length === 0 && <p className="text-gray-400 text-sm">Niciun element. Adaugă din dreapta.</p>}
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {items.map(item => (
                      <SortableItem key={item.id} item={item} onRemove={removeItem} onUpdateDuration={updateDuration} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="w-56 p-4 overflow-y-auto bg-white">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Librărie media</p>
              <div className="flex flex-col gap-2">
                {allMedia.map(m => (
                  <div key={m.id} className="rounded-lg border text-sm transition-colors bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200 flex items-center gap-2 pr-1">
                    <button onClick={() => addItem(m)} className="text-left px-3 py-2 flex-1 flex items-center gap-2 min-w-0">
                      <span className="truncate">{m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}</span>
                      {inPlaylistCount[m.id] > 0 && (
                        <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                          ×{inPlaylistCount[m.id]}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setQuickPreview(m)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Previzualizează">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4 flex justify-between items-center">
            <button onClick={() => setPreviewing(true)} disabled={items.length === 0}
              className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-40">
              ▶ Previzualizare
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">Anulează</button>
              <button onClick={() => onSave(items)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                Confirmă playlist
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [agencies, setAgencies] = useState([])
  const [groups, setGroups] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewItems, setPreviewItems] = useState(null)

  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    items: [],
    selectedAgencyIds: new Set(),
  })

  const load = async () => {
    const [c, a, g] = await Promise.all([getCampaigns(), getAgencies(), getGroups()])
    setCampaigns(c)
    setAgencies(a)
    setGroups(g)
  }

  useEffect(() => { load() }, [])

  const openEdit = (c) => {
    setEditingCampaign(c)
    setForm({
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      items: c.items.map(i => ({
        id: `item-${i.media_id}-${Math.random()}`,
        media_id: i.media_id,
        filename: i.filename,
        original_name: i.original_name,
        type: i.type,
        display_duration_seconds: i.display_duration_seconds ?? null,
      })),
      selectedAgencyIds: new Set(c.ids.map((_, idx) => {
        const ag = agencies.find(a => a.name === c.agencies[idx])
        return ag?.id
      }).filter(Boolean)),
    })
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingCampaign(null)
    setForm({ name: '', start_date: '', end_date: '', items: [], selectedAgencyIds: new Set() })
    setError('')
  }

  const toggleAgency = (agencyId) => {
    setForm(f => {
      const s = new Set(f.selectedAgencyIds)
      s.has(agencyId) ? s.delete(agencyId) : s.add(agencyId)
      return { ...f, selectedAgencyIds: s }
    })
  }

  const toggleGroup = (group) => {
    const groupAgencyIds = group.agencies.map(a => a.id)
    const allSelected = groupAgencyIds.every(id => form.selectedAgencyIds.has(id))
    setForm(f => {
      const s = new Set(f.selectedAgencyIds)
      if (allSelected) { groupAgencyIds.forEach(id => s.delete(id)) }
      else { groupAgencyIds.forEach(id => s.add(id)) }
      return { ...f, selectedAgencyIds: s }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.name || !form.start_date || !form.end_date) return setError('Completează toate câmpurile obligatorii.')
    if (!editingCampaign && form.selectedAgencyIds.size === 0) return setError('Selectează cel puțin o agenție sau regiune.')
    if (form.items.length === 0) return setError('Adaugă cel puțin un fișier media în playlist.')
    if (form.end_date <= form.start_date) {
      const minEnd = new Date(form.start_date + 'T12:00:00')
      minEnd.setDate(minEnd.getDate() + 1)
      const minEndStr = `${minEnd.getFullYear()}-${String(minEnd.getMonth()+1).padStart(2,'0')}-${String(minEnd.getDate()).padStart(2,'0')}`.split('-').reverse().join('.')
      return setError(`O campanie trebuie să dureze cel puțin o zi. Data de final trebuie să fie minim ${minEndStr}.`)
    }

    const itemsPayload = form.items.map(i => ({
      media_id: i.media_id,
      display_duration_seconds: i.display_duration_seconds ?? null,
    }))

    setSaving(true)
    try {
      if (editingCampaign) {
        await Promise.all(
          editingCampaign.ids.map(id =>
            updateCampaign(id, { name: form.name, start_date: form.start_date, end_date: form.end_date, items: itemsPayload })
          )
        )
        setSuccess('Campanie actualizată!')
      } else {
        await Promise.all(
          [...form.selectedAgencyIds].map(agencyId =>
            createCampaign({ name: form.name, agency_id: agencyId, start_date: form.start_date, end_date: form.end_date, items: itemsPayload })
          )
        )
        setSuccess(`Campanie creată pentru ${form.selectedAgencyIds.size} agenție(nții)!`)
      }
      closeForm()
      load()
    } catch (e) {
      setError(e.response?.data?.error || 'Eroare la salvarea campaniei.')
    }
    setSaving(false)
  }

  const handleDelete = async (ids) => {
    if (!confirm('Ștergi această campanie?')) return
    await Promise.all(ids.map(id => deleteCampaign(id)))
    setCampaigns(c => c.filter(x => !ids.includes(x.id)))
  }

  const _d = new Date()
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

  const statusBadge = (c) => {
    if (c.end_date <= today) return <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Expirată</span>
    if (c.start_date > today) return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Programată</span>
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activă</span>
  }

  const groupedCampaigns = []
  const seen = new Map()
  for (const c of campaigns) {
    const key = `${c.name}||${c.start_date}||${c.end_date}`
    if (seen.has(key)) {
      seen.get(key).agencies.push(c.agency_name)
      seen.get(key).ids.push(c.id)
    } else {
      const entry = { ...c, agencies: [c.agency_name], ids: [c.id] }
      seen.set(key, entry)
      groupedCampaigns.push(entry)
    }
  }

  const groupedAgencyIds = new Set(groups.flatMap(g => g.agencies.map(a => a.id)))
  const ungroupedAgencies = agencies.filter(a => !groupedAgencyIds.has(a.id))

  const chipStatus = (c) => {
    if (c.end_date <= today) return { label:'Expirată', bg:'var(--chip-off-bg)', color:'var(--chip-off-fg)' }
    if (c.start_date > today) return { label:'Programată', bg:'rgba(245,158,11,.12)', color:'#B45309' }
    return { label:'Activă', bg:'var(--chip-on-bg)', color:'var(--chip-on-fg)' }
  }

  const inp = { height:34, padding:'0 12px', border:'1px solid var(--border)', borderRadius:8, background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', width:'100%' }
  const lbl = { fontSize:11.5, fontWeight:600, color:'var(--fg-2)', marginBottom:5, display:'block' }

  return (
    <div style={{ padding:24 }}>
      {previewItems && <PreviewPlayer items={previewItems} onClose={() => setPreviewItems(null)} />}

      {showPlaylistModal && (
        <CampaignPlaylistModal
          title={form.name || 'Campanie nouă'}
          initialItems={form.items}
          onSave={(items) => { setForm(f => ({ ...f, items })); setShowPlaylistModal(false) }}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontFamily:'Plus Jakarta Sans, system-ui, sans-serif', fontSize:20, fontWeight:800, color:'var(--fg)', letterSpacing:'-.3px' }}>Campanii</h2>
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:3 }}>{groupedCampaigns.length} campanii totale</p>
        </div>
        <button onClick={() => { setEditingCampaign(null); setShowForm(true); setError(''); setSuccess('') }}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 16px', borderRadius:8, background:'var(--accent)', color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Campanie nouă
        </button>
      </div>

      {success && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(16,185,129,.1)', color:'#059669', fontSize:13, marginBottom:14 }}>{success}</div>}
      {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,.08)', color:'#DC2626', fontSize:13, marginBottom:14 }}>{error}</div>}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:20, boxShadow:'var(--shadow-sm)' }}>
          <h3 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:14, color:'var(--fg)', marginBottom:16 }}>
            {editingCampaign ? `Editează: ${editingCampaign.name}` : 'Campanie nouă'}
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:16 }}>
            <div><label style={lbl}>Nume campanie *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Credit Ipotecar - TV Vitrina" style={inp} /></div>
            <div><label style={lbl}>Data start *</label>
              <DateInput value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} /></div>
            <div><label style={lbl}>Data final *</label>
              <DateInput value={form.end_date}
                min={form.start_date ? (() => { const d = new Date(form.start_date + 'T12:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })() : undefined}
                onChange={v => setForm(f => ({ ...f, end_date: v }))} /></div>
          </div>

          {!editingCampaign && (
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Regiuni / Agenții * {form.selectedAgencyIds.size > 0 && <span style={{ color:'var(--accent)' }}>· {form.selectedAgencyIds.size} selectate</span>}</label>
              <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                {groups.map(group => {
                  const groupAgencyIds = group.agencies.map(a => a.id)
                  const allSelected = groupAgencyIds.length > 0 && groupAgencyIds.every(id => form.selectedAgencyIds.has(id))
                  const someSelected = groupAgencyIds.some(id => form.selectedAgencyIds.has(id))
                  return (
                    <div key={group.id}>
                      <label style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:'var(--surface-2)', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                        <input type="checkbox" checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                          onChange={() => toggleGroup(group)} style={{ accentColor:'var(--accent)', width:14, height:14 }} />
                        <span style={{ fontWeight:700, fontSize:13, color:'var(--fg)' }}>{group.name}</span>
                        <span style={{ fontSize:11.5, color:'var(--fg-3)' }}>{group.agencies.length} agenții</span>
                      </label>
                      {group.agencies.map(ga => {
                        const agency = agencies.find(a => a.id === ga.id)
                        return (
                          <label key={ga.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 28px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                            <input type="checkbox" checked={form.selectedAgencyIds.has(ga.id)}
                              onChange={() => toggleAgency(ga.id)} style={{ accentColor:'var(--accent)', width:13, height:13 }} />
                            <span style={{ fontSize:13, color:'var(--fg-2)' }}>{ga.name}</span>
                            {agency?.city && <span style={{ fontSize:11.5, color:'var(--fg-3)' }}>{agency.city}</span>}
                          </label>
                        )
                      })}
                    </div>
                  )
                })}
                {ungroupedAgencies.map(a => (
                  <label key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                    <input type="checkbox" checked={form.selectedAgencyIds.has(a.id)}
                      onChange={() => toggleAgency(a.id)} style={{ accentColor:'var(--accent)', width:14, height:14 }} />
                    <span style={{ fontSize:13, color:'var(--fg-2)' }}>{a.name}</span>
                    <span style={{ fontSize:11.5, color:'var(--fg-3)' }}>{a.city}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Playlist */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label style={{ ...lbl, marginBottom:0 }}>Playlist * {form.items.length > 0 && <span style={{ color:'var(--accent)' }}>· {form.items.length} elemente</span>}</label>
              <button type="button" onClick={() => setShowPlaylistModal(true)}
                style={{ display:'inline-flex', alignItems:'center', gap:6, height:28, padding:'0 10px', borderRadius:6, background:'var(--fg)', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Modifică playlist
              </button>
            </div>
            {form.items.length === 0 ? (
              <div style={{ border:'2px dashed var(--border)', borderRadius:8, padding:'20px', textAlign:'center' }}>
                <p style={{ fontSize:13, color:'var(--fg-3)' }}>Niciun element în playlist.</p>
                <button type="button" onClick={() => setShowPlaylistModal(true)}
                  style={{ marginTop:6, color:'var(--accent)', fontSize:13, fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>
                  + Adaugă fișiere media
                </button>
              </div>
            ) : (
              <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                {form.items.map((item, i) => (
                  <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderBottom:'1px solid var(--border)', fontSize:13, color:'var(--fg-2)' }}>
                    <span style={{ color:'var(--fg-3)', fontSize:11, width:18, textAlign:'right', flexShrink:0 }}>{i+1}.</span>
                    <span>{item.type === 'video' ? '🎬' : '🖼️'}</span>
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.original_name}</span>
                    {item.type === 'image' && <span style={{ fontSize:11.5, color:'var(--fg-3)', flexShrink:0 }}>{item.display_duration_seconds}s</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" disabled={saving}
              style={{ height:36, padding:'0 20px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving?.6:1 }}>
              {saving ? 'Se salvează...' : 'Salvează campania'}
            </button>
            <button type="button" onClick={closeForm}
              style={{ height:36, padding:'0 16px', background:'var(--surface-2)', color:'var(--fg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, cursor:'pointer' }}>
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* Campaign list */}
      {groupedCampaigns.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0', color:'var(--fg-3)', fontSize:14 }}>Nicio campanie. Creează prima campanie!</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {groupedCampaigns.map(c => {
            const st = chipStatus(c)
            return (
              <div key={c.ids[0]} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:700, fontSize:14, color:'var(--fg)' }}>{c.name}</span>
                    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:99, fontSize:11.5, fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--fg-3)', marginBottom:6 }}>
                    {c.start_date} 00:01 → {c.end_date} 00:00 · {c.items.length} elemente
                  </p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {c.agencies.map((name, i) => (
                      <span key={i} style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99, background:'rgba(37,99,235,.08)', color:'var(--accent)' }}>{name}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  {c.items?.length > 0 && (
                    <button onClick={() => setPreviewItems(c.items)}
                      style={{ display:'inline-flex', alignItems:'center', gap:5, height:30, padding:'0 12px', borderRadius:7, background:'#2563EB', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Preview
                    </button>
                  )}
                  <button onClick={() => openEdit(c)}
                    style={{ height:30, padding:'0 12px', borderRadius:7, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--fg-2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Editează
                  </button>
                  <button onClick={() => handleDelete(c.ids)}
                    style={{ height:30, padding:'0 12px', borderRadius:7, border:'none', background:'rgba(239,68,68,.08)', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    Șterge
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
