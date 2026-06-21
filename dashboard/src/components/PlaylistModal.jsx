import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getMedia, setPlaylist } from '../api'

function SortableItem({ item, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2 shadow-sm">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400">⠿</span>
      <span className="text-lg">{item.type === 'video' ? '🎬' : '🖼️'}</span>
      <span className="text-sm flex-1 truncate">{item.original_name}</span>
      <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
    </div>
  )
}

export default function PlaylistModal({ agency, current, onClose, onSaved }) {
  const [allMedia, setAllMedia] = useState([])
  const [items, setItems] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => { getMedia().then(setAllMedia) }, [])

  const addItem = (media) => {
    if (items.find(i => i.media_id === media.id)) return
    setItems(prev => [...prev, {
      id: `new-${media.id}`,
      media_id: media.id,
      original_name: media.original_name,
      type: media.type,
      display_duration_seconds: media.type === 'image' ? 10 : null,
    }])
  }

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

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

  const inPlaylist = new Set(items.map(i => i.media_id))

  return (
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
                  {items.map(item => <SortableItem key={item.id} item={item} onRemove={removeItem} />)}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div className="w-56 p-4 overflow-y-auto bg-white">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Librărie media</p>
            <div className="flex flex-col gap-2">
              {allMedia.map(m => (
                <button key={m.id} onClick={() => addItem(m)} disabled={inPlaylist.has(m.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors
                    ${inPlaylist.has(m.id) ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                      : 'bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border-gray-200'}`}>
                  {m.type === 'video' ? '🎬' : '🖼️'} {m.original_name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">Anulează</button>
          <button onClick={save} disabled={saving}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>
    </div>
  )
}
