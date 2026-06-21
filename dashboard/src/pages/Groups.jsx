import { useState, useEffect } from 'react'
import {
  getGroups, createGroup, deleteGroup,
  addAgencyToGroup, removeAgencyFromGroup,
  getAgencies, getGroupPlaylist, setGroupPlaylist, getMedia
} from '../api'
import PlaylistModal from '../components/PlaylistModal'

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
  const [media, setMedia] = useState([])
  const [items, setItems] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getMedia().then(setMedia)
  }, [])

  const toggle = (m) => {
    if (items.find(i => i.media_id === m.id)) {
      setItems(prev => prev.filter(i => i.media_id !== m.id))
    } else {
      setItems(prev => [...prev, { media_id: m.id, display_duration_seconds: m.type === 'image' ? 10 : null }])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setGroupPlaylist(group.id, items)
      await onSaved()
      onClose()
    } catch {
      alert('Eroare la salvare playlist.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-gray-800">Playlist grup: {group.name}</h3>
            <p className="text-xs text-gray-400">Se aplică tuturor agențiilor din grup</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {media.length === 0 && (
            <p className="text-sm text-gray-400">Nu există conținut încărcat.</p>
          )}
          <div className="flex flex-col gap-2">
            {media.map(m => {
              const selected = !!items.find(i => i.media_id === m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors
                    ${selected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <span className="text-lg">{m.type === 'video' ? '🎬' : '🖼️'}</span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{m.original_name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${selected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    {selected ? 'Selectat' : 'Adaugă'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t p-4 flex justify-between items-center">
          <span className="text-xs text-gray-400">{items.length} fișiere selectate</span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border hover:border-gray-300">
              Anulează
            </button>
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
              {saving ? 'Se salvează...' : 'Salvează playlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
