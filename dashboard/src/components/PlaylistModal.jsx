import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getMedia, setPlaylist } from '../api'
import PreviewPlayer from './PreviewPlayer'

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
            type="number"
            min="1"
            max="300"
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

export default function PlaylistModal({ agency, current, onClose, onSaved }) {
  const [allMedia, setAllMedia] = useState([])
  const [items, setItems] = useState(current)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => { getMedia().then(setAllMedia) }, [])

  const addItem = (media) => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}-${Math.random()}`,
      media_id: media.id,
      filename: media.filename,
      original_name: media.original_name,
      type: media.type,
      display_duration_seconds: media.type === 'image' ? 10 : null,
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

  const save = async () => {
    setSaving(true)
    try {
      await setPlaylist(agency.id, items.map(i => ({
        media_id: i.media_id,
        display_duration_seconds: i.display_duration_seconds ?? null,
      })))
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Count how many times each media_id appears in playlist
  const inPlaylistCount = items.reduce((acc, i) => { acc[i.media_id] = (acc[i.media_id] || 0) + 1; return acc }, {})

  // Enrich items with filename for preview (merge with allMedia)
  const enrichedItems = items.map(item => {
    const media = allMedia.find(m => m.id === item.media_id)
    return { ...item, filename: item.filename || media?.filename }
  })

  return (
    <>
      {previewing && enrichedItems.length > 0 && (
        <PreviewPlayer items={enrichedItems} onClose={() => setPreviewing(false)} />
      )}

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="font-bold text-gray-800">Playlist — {agency.name}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 p-4 overflow-y-auto border-r">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Playlist curent (trage pentru reordonare)</p>
              {items.length === 0 && <p className="text-gray-400 text-sm">Niciun element. Adaugă din dreapta.</p>}
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {items.map(item => <SortableItem key={item.id} item={item} onRemove={removeItem} onUpdateDuration={updateDuration} />)}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
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
          <div className="px-6 py-4 border-t flex justify-between items-center">
            <button
              onClick={() => setPreviewing(true)}
              disabled={items.length === 0}
              className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-40">
              ▶ Previzualizare
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">Anulează</button>
              <button onClick={save} disabled={saving}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
