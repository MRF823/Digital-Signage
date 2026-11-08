import { useState } from 'react'
import { mediaUrl } from '../api'

function PreviewModal({ item, onClose }) {
  const url = mediaUrl(item.filename)
  const [loading, setLoading] = useState(true)
  const [portrait, setPortrait] = useState(false)

  const handleVideoMeta = (e) => {
    setLoading(false)
    const { videoWidth, videoHeight } = e.target
    if (videoWidth && videoHeight) setPortrait(videoHeight > videoWidth)
  }

  const handleImageLoad = (e) => {
    setLoading(false)
    const { naturalWidth, naturalHeight } = e.target
    if (naturalWidth && naturalHeight) setPortrait(naturalHeight > naturalWidth)
  }

  const frameStyle = portrait ? {
    height: 'min(70vh, 580px)',
    aspectRatio: '9/16',
    padding: '12px 12px 36px',
    borderRadius: 24,
  } : {
    width: 'min(80vw, 800px)',
    aspectRatio: '16/9',
    padding: '12px 12px 44px',
    borderRadius: 16,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: -36, right: 0, color: 'rgba(255,255,255,0.7)', fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >✕</button>

        {/* TV shell */}
        <div style={{
          ...frameStyle,
          background: '#242424',
          boxShadow: '0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.11)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          flexShrink: 0,
        }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
              <div className="w-9 h-9 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Screen */}
          <div style={{ flex: 1, background: '#000', borderRadius: portrait ? 12 : 6, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            {item.type === 'video' ? (
              <video
                src={url}
                controls
                autoPlay
                onLoadedMetadata={handleVideoMeta}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: loading ? 0 : 1 }}
              />
            ) : (
              <img
                src={url}
                alt={item.original_name}
                onLoad={handleImageLoad}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: loading ? 0 : 1 }}
              />
            )}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 12, maxWidth: 400, textAlign: 'center', wordBreak: 'break-all' }}>{item.original_name}</p>
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
              onLoadedMetadata={e => { e.target.currentTime = Math.min(1, e.target.duration * 0.1) }}
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
          <p className="text-sm font-medium text-gray-800 break-all" title={item.original_name}>
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
