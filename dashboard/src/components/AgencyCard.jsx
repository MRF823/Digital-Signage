import { useState } from 'react'
import PlaylistModal from './PlaylistModal'
import PreviewPlayer from './PreviewPlayer'
import { addTv, deleteTv, deleteAgency, updateTvOrientation, renameAgency } from '../api'

function tvStatus(tv) {
  if (!tv.last_seen_at) return { online: false, label: 'Niciodată conectat', detail: '' }
  const date = new Date(tv.last_seen_at + 'Z')
  const diff = Date.now() - date.getTime()
  const pad = n => String(n).padStart(2, '0')
  const detail = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (diff < 60_000) return { online: true, label: 'Online', detail }
  const mins = Math.round(diff / 60_000)
  const timeLabel = mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h ${mins % 60}min`
  return { online: false, label: timeLabel, detail }
}

export default function AgencyCard({ agency, groupName, onPlaylistSaved, onDeleted }) {
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [addingTv, setAddingTv] = useState(false)
  const [tvLabel, setTvLabel] = useState('')
  const [tvOrientation, setTvOrientation] = useState('landscape')
  const [tvError, setTvError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState(agency.name)
  const [editCity, setEditCity] = useState(agency.city)
  const [renameError, setRenameError] = useState('')

  const handleRename = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return
    try {
      await renameAgency(agency.id, editName.trim(), editCity.trim())
      setEditingName(false)
      setRenameError('')
      onPlaylistSaved()
    } catch (err) {
      setRenameError(err?.response?.data?.error || 'Eroare la redenumire.')
    }
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
    } catch {
      setTvError('Eroare la adăugare TV.')
    }
  }

  const handleToggleOrientation = async (tv) => {
    const { online } = tvStatus(tv)
    if (online && !confirm(`"${tv.label}" este online. Ești sigur că vrei să schimbi orientarea?`)) return
    const next = tv.orientation === 'portrait' ? 'landscape' : 'portrait'
    try {
      await updateTvOrientation(agency.id, tv.id, next)
      onPlaylistSaved()
    } catch {}
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          {editingName ? (
            <form onSubmit={handleRename} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input autoFocus value={editName} onChange={e => { setEditName(e.target.value); setRenameError('') }}
                  placeholder="Nume agenție"
                  className="border rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 w-44" />
                <input value={editCity} onChange={e => setEditCity(e.target.value)}
                  placeholder="Oraș"
                  className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="text-xs bg-blue-700 text-white px-2 py-1 rounded-lg">Salvează</button>
                <button type="button" onClick={() => { setEditingName(false); setEditName(agency.name); setEditCity(agency.city); setRenameError('') }} className="text-xs text-gray-400 hover:text-gray-600">Anulează</button>
                {renameError && <p className="text-xs text-red-500">{renameError}</p>}
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-800">{agency.name}</h3>
                <span className="text-xs font-mono bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded whitespace-nowrap">ID:{agency.id}</span>
                <button onClick={() => { setEditingName(true); setEditName(agency.name); setEditCity(agency.city) }} className="text-xs text-gray-400 hover:text-blue-600" title="Redenumește">✏️</button>
              </div>
              <p className="text-xs text-gray-400">{agency.city}</p>
            </>
          )}
          {groupName && (
            <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
              Grup: {groupName}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {agency.playlist?.length > 0 && (
            <button onClick={() => setShowPreview(true)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Preview
            </button>
          )}
          {!groupName && (
            <button onClick={() => setShowModal(true)}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg">
              Modifică playlist
            </button>
          )}
          <button onClick={handleDeleteAgency}
            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1.5 rounded-lg">
            Șterge
          </button>
        </div>

      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {agency.tvs.length === 0 && (
          <span className="text-xs text-gray-400">Niciun TV adăugat.</span>
        )}
        {agency.tvs.map(tv => {
          const { online, label } = tvStatus(tv)
          const isPortrait = tv.orientation === 'portrait'
          return (
            <span key={tv.id}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full
                ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {online ? '●' : '○'} {tv.label} — {label}
              <button
                onClick={() => handleToggleOrientation(tv)}
                title={`Orientare: ${isPortrait ? 'Portret' : 'Peisaj'} — click pentru schimbare`}
                className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide cursor-pointer
                  ${isPortrait ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}
              >{isPortrait ? 'PORT.' : 'LAND.'}</button>
              {!online && (
                <button onClick={() => handleDeleteTv(tv)}
                  className="ml-1 text-gray-400 hover:text-red-500 leading-none">✕</button>
              )}
            </span>
          )
        })}
        <button onClick={() => setAddingTv(v => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 px-2 py-1 rounded-full">
          + TV
        </button>
      </div>

      {addingTv && (
        <form onSubmit={handleAddTv} className="flex gap-2 mb-3 items-center flex-wrap">
          <input
            value={tvLabel}
            onChange={e => setTvLabel(e.target.value)}
            placeholder='ex: "TV-1" sau "TV-Recepție"'
            className="flex-1 min-w-32 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex rounded border overflow-hidden text-xs">
            <button type="button"
              onClick={() => setTvOrientation('landscape')}
              className={`px-2 py-1.5 flex items-center gap-1 transition-colors ${tvOrientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              ▭ Peisaj
            </button>
            <button type="button"
              onClick={() => setTvOrientation('portrait')}
              className={`px-2 py-1.5 flex items-center gap-1 transition-colors ${tvOrientation === 'portrait' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              ▯ Portret
            </button>
          </div>
          <button type="submit"
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            Adaugă
          </button>
          <button type="button" onClick={() => setAddingTv(false)}
            className="text-xs text-gray-400 hover:text-gray-600">
            Anulează
          </button>
        </form>
      )}
      {tvError && <p className="text-xs text-red-500 mb-2">{tvError}</p>}

      <div className="flex flex-wrap gap-2">
        {agency.playlist?.length === 0 && (
          <span className="text-xs text-gray-400">Niciun conținut asignat.</span>
        )}
        {agency.playlist?.map((item, i) => (
          <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
            {item.type === 'video' ? '🎬' : '🖼️'} {item.original_name}
          </span>
        ))}
      </div>

      {showPreview && agency.playlist?.length > 0 && (
        <PreviewPlayer items={agency.playlist} onClose={() => setShowPreview(false)} />
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
  )
}
