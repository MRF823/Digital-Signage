import { mediaUrl } from '../api'

export default function MediaCard({ item, onDelete }) {
  const isVideo = item.type === 'video'
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-100 h-32 flex items-center justify-center text-4xl">
        {isVideo ? '🎬' : '🖼️'}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 truncate" title={item.original_name}>
          {item.original_name}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {item.type} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB
          {item.duration_seconds ? ` · ${Math.round(item.duration_seconds)}s` : ''}
        </p>
        <button onClick={() => onDelete(item.id)}
          className="mt-2 text-xs text-red-500 hover:text-red-700">
          Șterge
        </button>
      </div>
    </div>
  )
}
