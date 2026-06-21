import { useState } from 'react'
import { mediaUrl } from '../api'

function PreviewModal({ item, onClose }) {
  const url = mediaUrl(item.filename)
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
        >
          ✕
        </button>
        {item.type === 'video' ? (
          <video
            src={url}
            controls
            autoPlay
            className="w-full rounded-lg max-h-[80vh]"
          />
        ) : (
          <img
            src={url}
            alt={item.original_name}
            className="w-full rounded-lg max-h-[80vh] object-contain"
          />
        )}
        <p className="text-white text-sm text-center mt-3 opacity-70">{item.original_name}</p>
      </div>
    </div>
  )
}

export default function MediaCard({ item, onDelete }) {
  const [showPreview, setShowPreview] = useState(false)
  const isVideo = item.type === 'video'
  const url = mediaUrl(item.filename)

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm group">
        {/* Thumbnail / preview zone */}
        <div
          className="relative h-36 bg-gray-100 cursor-pointer overflow-hidden"
          onClick={() => setShowPreview(true)}
        >
          {isVideo ? (
            <video
              src={url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
            />
          ) : (
            <img
              src={url}
              alt={item.original_name}
              className="w-full h-full object-cover"
            />
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <span className="text-white text-4xl opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
              {isVideo ? '▶' : '🔍'}
            </span>
          </div>
        </div>

        <div className="p-3">
          <p className="text-sm font-medium text-gray-800 truncate" title={item.original_name}>
            {item.original_name}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {item.type} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB
            {item.duration_seconds ? ` · ${Math.round(item.duration_seconds)}s` : ''}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setShowPreview(true)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {isVideo ? 'Redă' : 'Vezi'}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Șterge
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <PreviewModal item={item} onClose={() => setShowPreview(false)} />
      )}
    </>
  )
}
