import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getGroups, createGroup, deleteGroup, renameGroup,
  addAgencyToGroup, removeAgencyFromGroup,
  getAgencies, getGroupPlaylist, setGroupPlaylist, getMedia,
  getSchedules, createSchedule, deleteSchedule,
  updateGroupTransition, updateGroupPower, mediaUrl
} from '../api'
import PlaylistModal from '../components/PlaylistModal'
import PreviewPlayer from '../components/PreviewPlayer'

function SortableItem({ item, onRemove, onUpdateDuration }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition,
      display:'flex', alignItems:'center', gap:10, background:'var(--surface)',
      border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px' }}>
      <span {...attributes} {...listeners} style={{ cursor:'grab', color:'var(--fg-3)', fontSize:14 }}>⠿</span>
      <span style={{ fontSize:16 }}>{item.type === 'video' ? '🎬' : '🖼️'}</span>
      <span style={{ fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--fg-2)' }}>{item.original_name}</span>
      {item.type === 'image' && (
        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
          <input
            type="number" min="1" max="300"
            value={item.display_duration_seconds ?? 10}
            onChange={e => onUpdateDuration(item.id, parseInt(e.target.value, 10) || 10)}
            style={{ width:52, fontSize:12, border:'1px solid var(--border)', borderRadius:5, padding:'2px 6px',
              textAlign:'center', background:'var(--surface)', color:'var(--fg)', outline:'none' }}
          />
          <span style={{ fontSize:12, color:'var(--fg-3)' }}>sec</span>
        </div>
      )}
      <button onClick={() => onRemove(item.id)} style={{ fontSize:12, color:'#F87171', background:'none', border:'none', cursor:'pointer' }}>✕</button>
    </div>
  )
}

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [ungroupedAgencies, setUngroupedAgencies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [formError, setFormError] = useState('')
  const [playlistGroup, setPlaylistGroup] = useState(null)
  const [playlistItems, setPlaylistItems] = useState([])
  const [scheduleGroup, setScheduleGroup] = useState(null)

  const load = async () => {
    const [gs, agencies] = await Promise.all([getGroups(), getAgencies()])
    setGroups(gs)
    const groupedIds = new Set(gs.flatMap(g => g.agencies.map(a => a.id)))
    setUngroupedAgencies(agencies.filter(a => !groupedIds.has(a.id)))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!newName.trim()) return setFormError('Introdu un nume pentru grup.')
    try {
      await createGroup(newName.trim())
      setNewName('')
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Eroare la creare grup.')
    }
  }

  const handleDeleteGroup = async (group) => {
    if (!confirm(`Ștergi grupul "${group.name}"? Agențiile vor fi disponibile din nou individual.`)) return
    await deleteGroup(group.id)
    await load()
  }

  const handleAddAgency = async (groupId, agencyId) => {
    await addAgencyToGroup(groupId, agencyId)
    await load()
  }

  const handleRemoveAgency = async (groupId, agencyId) => {
    await removeAgencyFromGroup(groupId, agencyId)
    await load()
  }

  const openPlaylist = async (group) => {
    const items = await getGroupPlaylist(group.id)
    setPlaylistItems(items)
    setPlaylistGroup(group)
  }

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:22, color:'var(--fg)', margin:0 }}>
            Grupuri
          </h1>
          <p style={{ fontSize:13, color:'var(--fg-3)', marginTop:3 }}>{groups.length} grupuri configurate</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 16px',
            background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Grup nou
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleCreate}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
            padding:16, marginBottom:16, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end',
            boxShadow:'var(--shadow-sm)' }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', marginBottom:4, fontWeight:600 }}>Nume grup</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='"Nord București"'
              style={{ height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:8,
                background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', width:240 }} />
          </div>
          <button type="submit"
            style={{ height:36, padding:'0 16px', background:'var(--accent)', color:'#fff', border:'none',
              borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Creează
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            style={{ fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
            Anulează
          </button>
          {formError && <p style={{ fontSize:12, color:'#DC2626', width:'100%', margin:0 }}>{formError}</p>}
        </form>
      )}

      {groups.length === 0 && (
        <div style={{ background:'var(--surface)', border:'2px dashed var(--border)', borderRadius:12,
          padding:'48px 24px', textAlign:'center', color:'var(--fg-3)' }}>
          <p style={{ fontSize:14, margin:0 }}>Niciun grup creat.</p>
          <p style={{ fontSize:12.5, marginTop:6 }}>Creează un grup și adaugă agenții pentru a le asigna un playlist comun.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            ungroupedAgencies={ungroupedAgencies}
            onAddAgency={handleAddAgency}
            onRemoveAgency={handleRemoveAgency}
            onDelete={handleDeleteGroup}
            onPlaylist={openPlaylist}
            onSchedule={setScheduleGroup}
            onTransitionChange={load}
          />
        ))}
      </div>

      {playlistGroup && (
        <GroupPlaylistModal
          group={playlistGroup}
          current={playlistItems}
          onClose={() => setPlaylistGroup(null)}
          onSaved={load}
        />
      )}
      {scheduleGroup && (
        <ScheduleModal
          group={scheduleGroup}
          onClose={() => setScheduleGroup(null)}
        />
      )}
    </div>
  )
}

const TRANSITIONS = [
  { value: 'none',  label: 'Fără' },
  { value: 'fade',  label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom',  label: 'Zoom' },
]

function GroupCard({ group, ungroupedAgencies, onAddAgency, onRemoveAgency, onDelete, onPlaylist, onSchedule, onTransitionChange }) {
  const [showAddAgency, setShowAddAgency] = useState(false)
  const [selected, setSelected] = useState([])
  const [adding, setAdding] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [transition, setTransition] = useState(group.transition || 'fade')
  const [powerOn, setPowerOn] = useState(group.power_on_time || '')
  const [powerOff, setPowerOff] = useState(group.power_off_time || '')
  const [powerSaving, setPowerSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [renameError, setRenameError] = useState('')

  const handleRename = async (e) => {
    e.preventDefault()
    if (!editName.trim() || editName.trim() === group.name) { setEditingName(false); return }
    try {
      await renameGroup(group.id, editName.trim())
      setEditingName(false); setRenameError(''); onTransitionChange?.()
    } catch (err) { setRenameError(err?.response?.data?.error || 'Eroare la redenumire.') }
  }

  const handleTransition = async (val) => {
    setTransition(val)
    await updateGroupTransition(group.id, val).catch(() => {})
    onTransitionChange?.()
  }

  const handleSavePower = async () => {
    setPowerSaving(true)
    await updateGroupPower(group.id, powerOn || null, powerOff || null).catch(() => {})
    setPowerSaving(false)
  }

  const handleClearPower = async () => {
    setPowerOn(''); setPowerOff('')
    await updateGroupPower(group.id, null, null).catch(() => {})
  }

  const toggleAgency = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleAdd = async () => {
    if (selected.length === 0) return
    setAdding(true)
    for (const id of selected) await onAddAgency(group.id, id)
    setSelected([]); setShowAddAgency(false); setAdding(false)
  }

  const chip = (bg, color, border) => ({ display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:500,
    padding:'3px 10px', borderRadius:99, background:bg, color, border: border || 'none' })

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
      boxShadow:'var(--shadow-sm)', overflow:'hidden' }}>
      {showPreview && group.playlist?.length > 0 && (
        <PreviewPlayer items={group.playlist} onClose={() => setShowPreview(false)}
          portrait={group.agencies?.some(a => a.tvs?.some(t => t.orientation === 'portrait'))} />
      )}

      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex',
        alignItems:'flex-start', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <div>
          {editingName ? (
            <form onSubmit={handleRename} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input autoFocus value={editName} onChange={e => { setEditName(e.target.value); setRenameError('') }}
                style={{ height:30, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6,
                  background:'var(--surface)', color:'var(--fg)', fontSize:13, fontWeight:700, outline:'none', width:180 }} />
              <button type="submit" style={{ height:28, padding:'0 10px', background:'var(--accent)', color:'#fff',
                border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>Salvează</button>
              <button type="button" onClick={() => { setEditingName(false); setEditName(group.name); setRenameError('') }}
                style={{ fontSize:12, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>Anulează</button>
              {renameError && <span style={{ fontSize:11.5, color:'#DC2626' }}>{renameError}</span>}
            </form>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:15, color:'var(--fg)' }}>{group.name}</span>
              <button onClick={() => { setEditingName(true); setEditName(group.name) }}
                style={{ fontSize:11, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>✏️</button>
            </div>
          )}
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2 }}>
            {group.agencies.length} {group.agencies.length === 1 ? 'agenție' : 'agenții'}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          {/* Transition selector */}
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
            {TRANSITIONS.map(t => (
              <button key={t.value} onClick={() => handleTransition(t.value)}
                style={{ padding:'4px 10px', fontSize:11.5, fontWeight:600, border:'none', cursor:'pointer',
                  background: transition === t.value ? '#4F46E5' : 'var(--surface)',
                  color: transition === t.value ? '#fff' : 'var(--fg-2)' }}>
                {t.label}
              </button>
            ))}
          </div>
          {group.playlist?.length > 0 && (
            <button onClick={() => setShowPreview(true)}
              style={{ display:'inline-flex', alignItems:'center', gap:5, height:28, padding:'0 10px',
                background:'#2563EB', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Preview
            </button>
          )}
          <button onClick={() => onSchedule(group)}
            style={{ height:28, padding:'0 10px', background:'rgba(124,58,237,.08)', color:'#7C3AED',
              border:'1px solid rgba(124,58,237,.2)', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            ⏰ Scheduling
          </button>
          <button onClick={() => onPlaylist(group)}
            style={{ height:28, padding:'0 10px', background:'rgba(37,99,235,.07)', color:'var(--accent)',
              border:'1px solid rgba(37,99,235,.15)', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Modifică playlist
          </button>
          <button onClick={() => onDelete(group)}
            style={{ height:28, padding:'0 10px', background:'rgba(239,68,68,.07)', color:'#DC2626',
              border:'1px solid rgba(239,68,68,.15)', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Șterge
          </button>
        </div>
      </div>

      {/* Agencies */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
        <p style={{ fontSize:11.5, color:'var(--fg-3)', fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          Agenții în grup
        </p>
        {group.agencies.length === 0 && (
          <span style={{ fontSize:12.5, color:'var(--fg-3)' }}>Nicio agenție adăugată.</span>
        )}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {group.agencies.map(a => (
            <span key={a.id} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12.5, fontWeight:500,
              padding:'3px 10px', borderRadius:99, background:'rgba(37,99,235,.07)', color:'var(--accent)',
              border:'1px solid rgba(37,99,235,.15)' }}>
              {a.name}
              <button onClick={() => onRemoveAgency(group.id, a.id)}
                style={{ fontSize:11, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer', lineHeight:1 }}>✕</button>
            </span>
          ))}
          <button onClick={() => { setShowAddAgency(v => !v); setSelected([]) }}
            style={{ fontSize:12, color:'var(--accent)', background:'none', border:'1.5px dashed var(--border)',
              padding:'3px 10px', borderRadius:99, cursor:'pointer', fontWeight:600 }}>
            + Adaugă agenții
          </button>
        </div>

        {showAddAgency && (
          <div style={{ marginTop:12, border:'1px solid var(--border)', borderRadius:8,
            padding:12, background:'var(--surface-2)' }}>
            {ungroupedAgencies.length === 0 ? (
              <p style={{ fontSize:12, color:'var(--fg-3)' }}>Toate agențiile sunt deja în grupuri.</p>
            ) : (
              <>
                <p style={{ fontSize:12, color:'var(--fg-3)', marginBottom:8 }}>Bifează agențiile de adăugat:</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto', marginBottom:10 }}>
                  {ungroupedAgencies.map(a => (
                    <label key={a.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--fg-2)' }}>
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleAgency(a.id)}
                        style={{ accentColor:'var(--accent)', width:14, height:14 }} />
                      {a.name} <span style={{ fontSize:12, color:'var(--fg-3)' }}>({a.city})</span>
                    </label>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button onClick={handleAdd} disabled={selected.length === 0 || adding}
                    style={{ height:28, padding:'0 12px', background:'var(--accent)', color:'#fff',
                      border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                      opacity:(selected.length === 0 || adding)?.4:1 }}>
                    {adding ? 'Se adaugă...' : `Adaugă${selected.length > 0 ? ` (${selected.length})` : ''}`}
                  </button>
                  <button onClick={() => { setShowAddAgency(false); setSelected([]) }}
                    style={{ fontSize:12, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
                    Anulează
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Playlist preview */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', flexWrap:'wrap', gap:5 }}>
        {(group.playlist?.length === 0 || !group.playlist) && (
          <span style={{ fontSize:12.5, color:'var(--fg-3)' }}>Niciun conținut asignat grupului.</span>
        )}
        {group.playlist?.map((item, i) => (
          <span key={i} style={{ fontSize:12, fontWeight:500, padding:'2px 8px', borderRadius:6,
            background:'rgba(37,99,235,.07)', color:'var(--accent)', border:'1px solid rgba(37,99,235,.12)' }}>
            {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
          </span>
        ))}
      </div>

      {/* Power schedule */}
      <div style={{ padding:'12px 16px' }}>
        <p style={{ fontSize:11.5, color:'var(--fg-3)', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          ⏻ Pornire / Oprire automată
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10 }}>
          {[
            { label:'Pornire', color:'#059669', val:powerOn, set:setPowerOn },
            { label:'Oprire', color:'#DC2626', val:powerOff, set:setPowerOff },
          ].map(({ label, color, val, set }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, fontWeight:600, color, width:52 }}>{label}</span>
              <input type="time" value={val} onChange={e => set(e.target.value)}
                style={{ height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:6,
                  background:'var(--surface)', color:'var(--fg)', fontSize:12, outline:'none', width:100 }} />
            </div>
          ))}
          <button onClick={handleSavePower} disabled={powerSaving}
            style={{ height:28, padding:'0 12px', background:'var(--fg)', color:'var(--surface)',
              border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', opacity:powerSaving?.5:1 }}>
            {powerSaving ? 'Se salvează...' : 'Salvează'}
          </button>
          <button onClick={handleClearPower}
            style={{ height:28, padding:'0 12px', fontSize:12, fontWeight:600, cursor:'pointer',
              borderRadius:6, border:'1px solid var(--border)',
              background: (!group.power_on_time && !group.power_off_time) ? '#059669' : 'var(--surface)',
              color: (!group.power_on_time && !group.power_off_time) ? '#fff' : 'var(--fg-3)' }}>
            24/24
          </button>
        </div>
        {powerOn && powerOff && (
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:6 }}>
            Ecranele vor fi active {powerOn} – {powerOff}{powerOn >= powerOff ? ' (peste noapte)' : ' zilnic'}
          </p>
        )}
      </div>
    </div>
  )
}

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

function ScheduleModal({ group, onClose }) {
  const [slots, setSlots] = useState([])
  const [allMedia, setAllMedia] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', days: [], start_time: '08:00', end_time: '18:00', items: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => getSchedules(group.id).then(setSlots).catch(() => {})

  useEffect(() => { load(); getMedia().then(setAllMedia) }, [])

  const toggleDay = (d) => setForm(f => ({
    ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d]
  }))

  const addMedia = (m) => setForm(f => ({
    ...f, items: [...f.items, {
      id: `${Date.now()}-${Math.random()}`, media_id: m.id,
      original_name: m.original_name, type: m.type,
      display_duration_seconds: m.type === 'image' ? 10 : null,
    }]
  }))

  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))

  const handleSave = async () => {
    setError('')
    if (form.days.length === 0) return setError('Selectează cel puțin o zi.')
    if (form.items.length === 0) return setError('Adaugă cel puțin un fișier.')
    if (form.start_time >= form.end_time) return setError('Ora de start trebuie să fie înainte de ora de final.')
    setSaving(true)
    try {
      await createSchedule(group.id, {
        name: form.name || `Slot ${form.start_time}-${form.end_time}`,
        days: form.days.sort(), start_time: form.start_time, end_time: form.end_time,
        items: form.items.map(i => ({ media_id: i.media_id, display_duration_seconds: i.display_duration_seconds ?? null })),
      })
      setForm({ name: '', days: [], start_time: '08:00', end_time: '18:00', items: [] })
      setShowForm(false); load()
    } catch { setError('Eroare la salvare.') } finally { setSaving(false) }
  }

  const handleDelete = async (slotId) => {
    if (!confirm('Ștergi acest slot de scheduling?')) return
    await deleteSchedule(group.id, slotId); load()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,.3)',
        width:'100%', maxWidth:640, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 24px', borderBottom:'1px solid var(--border)' }}>
          <div>
            <p style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:16, color:'var(--fg)', margin:0 }}>
              Scheduling — {group.name}
            </p>
            <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2 }}>Playlist diferit pe intervale orare</p>
          </div>
          <button onClick={onClose} style={{ fontSize:20, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {slots.length === 0 && !showForm && (
            <div style={{ textAlign:'center', color:'var(--fg-3)', fontSize:13, padding:'40px 0' }}>
              Niciun slot configurat. Adaugă primul interval orar.
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {slots.map(slot => (
              <div key={slot.id} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontWeight:700, fontSize:13.5, color:'var(--fg)', margin:0 }}>{slot.name}</p>
                    <p style={{ fontSize:12, color:'#7C3AED', fontWeight:600, marginTop:3 }}>
                      {slot.start_time} – {slot.end_time}
                    </p>
                    <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                      {DAYS.map((d, i) => (
                        <span key={i} style={{ fontSize:11, padding:'2px 6px', borderRadius:5, fontWeight:600,
                          background: slot.days.includes(i) ? 'rgba(124,58,237,.12)' : 'var(--surface)',
                          color: slot.days.includes(i) ? '#7C3AED' : 'var(--fg-3)',
                          border:`1px solid ${slot.days.includes(i) ? 'rgba(124,58,237,.2)' : 'var(--border)'}` }}>
                          {d.slice(0,2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(slot.id)}
                    style={{ fontSize:12, color:'#DC2626', background:'rgba(239,68,68,.07)',
                      border:'1px solid rgba(239,68,68,.15)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>
                    Șterge
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:10 }}>
                  {slot.items.map((item, i) => (
                    <span key={i} style={{ fontSize:11.5, padding:'2px 8px', borderRadius:6,
                      background:'rgba(37,99,235,.07)', color:'var(--accent)', border:'1px solid rgba(37,99,235,.12)' }}>
                      {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {showForm && (
            <div style={{ background:'var(--surface-2)', border:'1px solid rgba(124,58,237,.2)', borderRadius:10, padding:16 }}>
              <p style={{ fontWeight:700, fontSize:13, color:'var(--fg)', marginBottom:14 }}>Slot nou</p>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11.5, color:'var(--fg-3)', display:'block', marginBottom:5 }}>Nume (opțional)</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Program dimineață"
                  style={{ width:'100%', height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:7,
                    background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11.5, color:'var(--fg-3)', display:'block', marginBottom:5 }}>Zile</label>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {DAYS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      style={{ padding:'4px 10px', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid',
                        background: form.days.includes(i) ? '#7C3AED' : 'var(--surface)',
                        color: form.days.includes(i) ? '#fff' : 'var(--fg-2)',
                        borderColor: form.days.includes(i) ? '#7C3AED' : 'var(--border)' }}>
                      {d.slice(0,2)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                {[{label:'De la',val:form.start_time,key:'start_time'},{label:'Până la',val:form.end_time,key:'end_time'}].map(f => (
                  <div key={f.key} style={{ flex:1 }}>
                    <label style={{ fontSize:11.5, color:'var(--fg-3)', display:'block', marginBottom:5 }}>{f.label}</label>
                    <input type="time" value={f.val} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ width:'100%', height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:7,
                        background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11.5, color:'var(--fg-3)', display:'block', marginBottom:5 }}>Fișiere pentru acest interval</label>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1, border:'1px solid var(--border)', borderRadius:7, padding:8, minHeight:60, background:'var(--surface)' }}>
                    {form.items.length === 0 && <p style={{ fontSize:12, color:'var(--fg-3)' }}>Adaugă din dreapta →</p>}
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {form.items.map(item => (
                        <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12,
                          background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:5, padding:'4px 8px' }}>
                          <span>{item.type === 'video' ? '🎬' : '🖼️'}</span>
                          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>{item.original_name}</span>
                          {item.type === 'image' && (
                            <input type="number" min="1" max="300" value={item.display_duration_seconds ?? 10}
                              onChange={e => setForm(f => ({ ...f, items: f.items.map(i => i.id === item.id
                                ? { ...i, display_duration_seconds: parseInt(e.target.value) || 10 } : i) }))}
                              style={{ width:44, border:'1px solid var(--border)', borderRadius:4, padding:'1px 4px',
                                textAlign:'center', fontSize:11, background:'var(--surface)', color:'var(--fg)', outline:'none' }} />
                          )}
                          {item.type === 'image' && <span style={{ fontSize:11, color:'var(--fg-3)' }}>s</span>}
                          <button onClick={() => removeItem(item.id)} style={{ color:'#F87171', background:'none', border:'none', cursor:'pointer' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ width:160, border:'1px solid var(--border)', borderRadius:7, padding:8,
                    overflowY:'auto', maxHeight:140, background:'var(--surface)' }}>
                    <p style={{ fontSize:11, color:'var(--fg-3)', marginBottom:5 }}>Librărie</p>
                    {allMedia.map(m => (
                      <button key={m.id} onClick={() => addMedia(m)}
                        style={{ width:'100%', textAlign:'left', fontSize:12, padding:'4px 8px', borderRadius:5, cursor:'pointer',
                          background:'none', border:'none', color:'var(--fg-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error && <p style={{ fontSize:12, color:'#DC2626', marginBottom:8 }}>{error}</p>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ height:34, padding:'0 16px', background:'#7C3AED', color:'#fff',
                    border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving?.5:1 }}>
                  {saving ? 'Se salvează...' : 'Salvează slot'}
                </button>
                <button onClick={() => { setShowForm(false); setError('') }}
                  style={{ fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
                  Anulează
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop:'1px solid var(--border)', padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              style={{ height:34, padding:'0 16px', background:'#7C3AED', color:'#fff',
                border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              + Adaugă slot
            </button>
          )}
          <button onClick={onClose} style={{ marginLeft:'auto', fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupPlaylistModal({ group, current, onClose, onSaved }) {
  const [allMedia, setAllMedia] = useState([])
  const [items, setItems] = useState(current.map(i => ({ ...i, id: `item-${i.media_id}-${Math.random()}` })))
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [quickPreview, setQuickPreview] = useState(null)

  useEffect(() => { getMedia().then(setAllMedia) }, [])

  const addItem = (m) => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random()}`, media_id: m.id,
      filename: m.filename, original_name: m.original_name, type: m.type,
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await setGroupPlaylist(group.id, items.map(i => ({ media_id: i.media_id, display_duration_seconds: i.display_duration_seconds ?? null })))
      await onSaved(); onClose()
    } catch { alert('Eroare la salvare playlist.') } finally { setSaving(false) }
  }

  const inPlaylistCount = items.reduce((acc, i) => { acc[i.media_id] = (acc[i.media_id] || 0) + 1; return acc }, {})
  const enrichedItems = items.map(item => {
    const m = allMedia.find(x => x.id === item.media_id)
    return { ...item, filename: item.filename || m?.filename }
  })

  return (
    <>
      {previewing && enrichedItems.length > 0 && (
        <PreviewPlayer items={enrichedItems} onClose={() => setPreviewing(false)}
          portrait={group.agencies?.some(a => a.tvs?.some(t => t.orientation === 'portrait'))} />
      )}
      {quickPreview && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:70 }} onClick={() => setQuickPreview(null)}>
          <div style={{ position:'relative', maxWidth:800, width:'100%', padding:'0 16px' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setQuickPreview(null)}
              style={{ position:'absolute', top:-40, right:16, color:'#fff', fontSize:24, background:'none', border:'none', cursor:'pointer' }}>✕</button>
            {quickPreview.type === 'video'
              ? <video src={mediaUrl(quickPreview.filename)} controls autoPlay
                  style={{ width:'100%', borderRadius:10, maxHeight:'75vh' }} />
              : <img src={mediaUrl(quickPreview.filename)} alt={quickPreview.original_name}
                  style={{ width:'100%', borderRadius:10, maxHeight:'75vh', objectFit:'contain' }} />
            }
            <p style={{ color:'#fff', fontSize:13, textAlign:'center', marginTop:12, opacity:.7 }}>{quickPreview.original_name}</p>
          </div>
        </div>
      )}
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex',
        alignItems:'center', justifyContent:'center', zIndex:50, padding:16 }}>
        <div style={{ background:'var(--surface)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,.3)',
          width:'100%', maxWidth:640, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'16px 24px', borderBottom:'1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:16, color:'var(--fg)', margin:0 }}>
                Playlist grup: {group.name}
              </p>
              <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:2 }}>Se aplică tuturor agențiilor din grup</p>
            </div>
            <button onClick={onClose} style={{ fontSize:20, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
            {/* Left: playlist */}
            <div style={{ flex:1, padding:16, overflowY:'auto', borderRight:'1px solid var(--border)' }}>
              <p style={{ fontSize:11, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                Playlist curent (trage pentru reordonare)
              </p>
              {items.length === 0 && <p style={{ fontSize:13, color:'var(--fg-3)' }}>Niciun element. Adaugă din dreapta.</p>}
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {items.map(item => (
                      <SortableItem key={item.id} item={item} onRemove={removeItem} onUpdateDuration={updateDuration} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Right: media library */}
            <div style={{ width:200, padding:16, overflowY:'auto', background:'var(--surface-2)' }}>
              <p style={{ fontSize:11, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                Librărie media
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {allMedia.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:4,
                    border:'1px solid var(--border)', borderRadius:7, background:'var(--surface)', overflow:'hidden' }}>
                    <button onClick={() => addItem(m)}
                      style={{ flex:1, textAlign:'left', fontSize:12.5, padding:'6px 10px', background:'none', border:'none',
                        cursor:'pointer', color:'var(--fg-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}</span>
                      {inPlaylistCount[m.id] > 0 && (
                        <span style={{ flexShrink:0, fontSize:10.5, background:'rgba(37,99,235,.1)', color:'var(--accent)',
                          padding:'1px 5px', borderRadius:99, fontWeight:700 }}>×{inPlaylistCount[m.id]}</span>
                      )}
                    </button>
                    <button onClick={() => setQuickPreview(m)}
                      style={{ width:26, height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                        background:'none', border:'none', cursor:'pointer', color:'var(--fg-3)', padding:'0 4px' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop:'1px solid var(--border)', padding:'14px 24px',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button onClick={() => setPreviewing(true)} disabled={items.length === 0}
              style={{ display:'inline-flex', alignItems:'center', gap:6, height:34, padding:'0 14px',
                background:'var(--fg)', color:'var(--surface)', border:'none', borderRadius:7,
                fontSize:13, fontWeight:600, cursor:'pointer', opacity:items.length === 0?.4:1 }}>
              ▶ Previzualizare
            </button>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <button onClick={onClose} style={{ fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>Anulează</button>
              <button onClick={handleSave} disabled={saving}
                style={{ height:34, padding:'0 18px', background:'var(--accent)', color:'#fff',
                  border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving?.5:1 }}>
                {saving ? 'Se salvează...' : 'Salvează playlist'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
