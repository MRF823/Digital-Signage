import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getGroups, createGroup, deleteGroup,
  addAgencyToGroup, removeAgencyFromGroup,
  getAgencies, getGroupPlaylist, setGroupPlaylist, getMedia
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
    } catch {
      setFormError('Eroare la creare grup.')
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
    </div>
  )
}

function GroupCard({ group, ungroupedAgencies, onAddAgency, onRemoveAgency, onDelete, onPlaylist }) {
  const [showAddAgency, setShowAddAgency] = useState(false)
  const [selected, setSelected] = useState([])
  const [adding, setAdding] = useState(false)

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
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">{group.name}</h3>
          <p className="text-xs text-gray-400">
            {group.agencies.length} {group.agencies.length === 1 ? 'agenție' : 'agenții'}
          </p>
        </div>
        <div className="flex gap-2">
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
      <div>
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
