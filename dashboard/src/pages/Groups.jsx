import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getGroups, createGroup, deleteGroup,
  addAgencyToGroup, removeAgencyFromGroup,
  getAgencies, getGroupPlaylist, setGroupPlaylist, getMedia,
  getSchedules, createSchedule, deleteSchedule,
  updateGroupTransition, updateGroupPower
} from '../api'
import PlaylistModal from '../components/PlaylistModal'
import PreviewPlayer from '../components/PreviewPlayer'

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
      <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Grupuri ({groups.length})</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Grup nou
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-white border border-blue-100 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end shadow-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nume grup</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='ex: "Nord București"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64" />
          </div>
          <button type="submit"
            className="bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-800">
            Creează
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="text-sm text-gray-400 hover:text-gray-600">
            Anulează
          </button>
          {formError && <p className="text-xs text-red-500 w-full">{formError}</p>}
        </form>
      )}

      {groups.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
          <p className="text-sm">Niciun grup creat.</p>
          <p className="text-xs mt-1">Creează un grup și adaugă agenții pentru a le asigna un playlist comun.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
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
    setPowerOn('')
    setPowerOff('')
    await updateGroupPower(group.id, null, null).catch(() => {})
  }

  const toggleAgency = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleAdd = async () => {
    if (selected.length === 0) return
    setAdding(true)
    for (const id of selected) {
      await onAddAgency(group.id, id)
    }
    setSelected([])
    setShowAddAgency(false)
    setAdding(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      {showPreview && group.playlist?.length > 0 && (
        <PreviewPlayer items={group.playlist} onClose={() => setShowPreview(false)} />
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">{group.name}</h3>
          <p className="text-xs text-gray-400">
            {group.agencies.length} {group.agencies.length === 1 ? 'agenție' : 'agenții'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Transition selector */}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden text-xs">
            {TRANSITIONS.map(t => (
              <button
                key={t.value}
                onClick={() => handleTransition(t.value)}
                title={`Tranziție: ${t.label}`}
                className={`px-2.5 py-1.5 font-medium transition-colors
                  ${transition === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {group.playlist?.length > 0 && (
            <button onClick={() => setShowPreview(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Preview
            </button>
          )}
          <button onClick={() => onSchedule(group)}
            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg">
            ⏰ Scheduling
          </button>
          <button onClick={() => onPlaylist(group)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg">
            Modifică playlist
          </button>
          <button onClick={() => onDelete(group)}
            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1.5 rounded-lg">
            Șterge
          </button>
        </div>
      </div>

      {/* Agencies in group */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 font-medium mb-2">Agenții în grup:</p>
        {group.agencies.length === 0 && (
          <span className="text-xs text-gray-400">Nicio agenție adăugată.</span>
        )}
        <div className="flex flex-wrap gap-2">
          {group.agencies.map(a => (
            <span key={a.id}
              className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded-full">
              {a.name}
              <button onClick={() => onRemoveAgency(group.id, a.id)}
                className="ml-1 text-blue-400 hover:text-red-500 leading-none font-bold">✕</button>
            </span>
          ))}

          <button onClick={() => { setShowAddAgency(v => !v); setSelected([]) }}
            className="text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 px-2 py-1 rounded-full">
            + Adaugă agenții
          </button>
        </div>

        {showAddAgency && (
          <div className="mt-3 border border-blue-100 rounded-lg p-3 bg-blue-50/40">
            {ungroupedAgencies.length === 0 ? (
              <p className="text-xs text-gray-400">Toate agențiile sunt deja în grupuri.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Bifează agențiile de adăugat:</p>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mb-3">
                  {ungroupedAgencies.map(a => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() => toggleAgency(a.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-blue-700">
                        {a.name} <span className="text-xs text-gray-400">({a.city})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={handleAdd} disabled={selected.length === 0 || adding}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40">
                    {adding ? 'Se adaugă...' : `Adaugă ${selected.length > 0 ? `(${selected.length})` : ''}`}
                  </button>
                  <button onClick={() => { setShowAddAgency(false); setSelected([]) }}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    Anulează
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Current playlist preview */}
      <div className="mb-3">
        {group.playlist?.length === 0 && (
          <span className="text-xs text-gray-400">Niciun conținut asignat grupului.</span>
        )}
        <div className="flex flex-wrap gap-2">
          {group.playlist?.map((item, i) => (
            <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
              {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
            </span>
          ))}
        </div>
      </div>

      {/* Power schedule */}
      <div className="border-t border-gray-100 pt-3 mt-1">
        <p className="text-xs text-gray-500 font-medium mb-2">⏻ Pornire / Oprire automată</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-green-700 font-medium w-12">Pornire</span>
            <input
              type="time"
              value={powerOn}
              onChange={e => setPowerOn(e.target.value)}
              className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 w-28"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 font-medium w-12">Oprire</span>
            <input
              type="time"
              value={powerOff}
              onChange={e => setPowerOff(e.target.value)}
              className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 w-28"
            />
          </div>
          <button
            onClick={handleSavePower}
            disabled={powerSaving}
            className="text-xs bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded disabled:opacity-50">
            {powerSaving ? 'Se salvează...' : 'Salvează'}
          </button>
          {(group.power_on_time || group.power_off_time) && (
            <button
              onClick={handleClearPower}
              className="text-xs text-gray-400 hover:text-red-500">
              Șterge program
            </button>
          )}
        </div>
        {powerOn && powerOff && (
          <p className="text-xs text-gray-400 mt-1.5">
            Ecranele vor fi active {powerOn} – {powerOff}
            {powerOn >= powerOff ? ' (peste noapte)' : ' zilnic'}
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

  useEffect(() => {
    load()
    getMedia().then(setAllMedia)
  }, [])

  const toggleDay = (d) => setForm(f => ({
    ...f,
    days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d]
  }))

  const addMedia = (m) => setForm(f => ({
    ...f,
    items: [...f.items, {
      id: `${Date.now()}-${Math.random()}`,
      media_id: m.id,
      original_name: m.original_name,
      type: m.type,
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
        days: form.days.sort(),
        start_time: form.start_time,
        end_time: form.end_time,
        items: form.items.map((i, pos) => ({ media_id: i.media_id, display_duration_seconds: i.display_duration_seconds ?? null })),
      })
      setForm({ name: '', days: [], start_time: '08:00', end_time: '18:00', items: [] })
      setShowForm(false)
      load()
    } catch {
      setError('Eroare la salvare.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (slotId) => {
    if (!confirm('Ștergi acest slot de scheduling?')) return
    await deleteSchedule(group.id, slotId)
    load()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Scheduling — {group.name}</h3>
            <p className="text-xs text-gray-400">Playlist diferit pe intervale orare</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Sloturi existente */}
          {slots.length === 0 && !showForm && (
            <div className="text-center text-gray-400 text-sm py-8">
              Niciun slot configurat. Adaugă primul interval orar.
            </div>
          )}
          <div className="flex flex-col gap-3 mb-4">
            {slots.map(slot => (
              <div key={slot.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{slot.name}</p>
                    <p className="text-xs text-purple-700 font-medium mt-0.5">
                      {slot.start_time} – {slot.end_time}
                    </p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {DAYS.map((d, i) => (
                        <span key={i} className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${slot.days.includes(i) ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                          {d.slice(0, 2)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(slot.id)}
                    className="text-red-400 hover:text-red-600 text-xs border border-red-100 hover:border-red-300 px-2 py-1 rounded">
                    Șterge
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {slot.items.map((item, i) => (
                    <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
                      {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Formular adăugare slot */}
          {showForm && (
            <div className="bg-white rounded-xl border border-purple-200 p-4">
              <p className="font-semibold text-gray-700 text-sm mb-4">Slot nou</p>

              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Nume (opțional)</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Program dimineață"
                  className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-purple-400" />
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Zile</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map((d, i) => (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors
                        ${form.days.includes(i)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}>
                      {d.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">De la</label>
                  <input type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Până la</label>
                  <input type="time" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">Fișiere pentru acest interval</label>
                <div className="flex gap-3">
                  <div className="flex-1 border rounded-lg p-2 min-h-16 bg-gray-50">
                    {form.items.length === 0 && <p className="text-xs text-gray-400">Adaugă din dreapta →</p>}
                    <div className="flex flex-col gap-1">
                      {form.items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1">
                          <span>{item.type === 'video' ? '🎬' : '🖼️'}</span>
                          <span className="flex-1 truncate">{item.original_name}</span>
                          {item.type === 'image' && (
                            <input type="number" min="1" max="300"
                              value={item.display_duration_seconds ?? 10}
                              onChange={e => setForm(f => ({
                                ...f,
                                items: f.items.map(i => i.id === item.id
                                  ? { ...i, display_duration_seconds: parseInt(e.target.value) || 10 }
                                  : i)
                              }))}
                              className="w-12 border rounded px-1 py-0.5 text-center text-xs" />
                          )}
                          {item.type === 'image' && <span className="text-gray-400">s</span>}
                          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-44 border rounded-lg p-2 bg-white overflow-y-auto max-h-40">
                    <p className="text-xs text-gray-400 mb-1">Librărie</p>
                    {allMedia.map(m => (
                      <button key={m.id} onClick={() => addMedia(m)}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-purple-50 hover:text-purple-700 truncate">
                        {m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Se salvează...' : 'Salvează slot'}
                </button>
                <button onClick={() => { setShowForm(false); setError('') }}
                  className="text-sm text-gray-400 hover:text-gray-600">
                  Anulează
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 flex justify-between">
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              + Adaugă slot
            </button>
          )}
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-700 text-sm">
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await setGroupPlaylist(group.id, items.map(i => ({
        media_id: i.media_id,
        display_duration_seconds: i.display_duration_seconds ?? null,
      })))
      await onSaved()
      onClose()
    } catch {
      alert('Eroare la salvare playlist.')
    } finally {
      setSaving(false)
    }
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Playlist grup: {group.name}</h3>
            <p className="text-xs text-gray-400">Se aplică tuturor agențiilor din grup</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: ordered playlist */}
          <div className="flex-1 p-4 overflow-y-auto border-r">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Playlist curent (trage pentru reordonare)</p>
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

          {/* Right: media library */}
          <div className="w-56 p-4 overflow-y-auto bg-white">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Librărie media</p>
            <div className="flex flex-col gap-2">
              {allMedia.map(m => (
                <button key={m.id} onClick={() => addItem(m)}
                  className="text-left px-3 py-2 rounded-lg border text-sm transition-colors bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200 flex items-center justify-between gap-2">
                  <span>{m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}</span>
                  {inPlaylistCount[m.id] > 0 && (
                    <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                      ×{inPlaylistCount[m.id]}
                    </span>
                  )}
                </button>
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
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
              {saving ? 'Se salvează...' : 'Salvează playlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
