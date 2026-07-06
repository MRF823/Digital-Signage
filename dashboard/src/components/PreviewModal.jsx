import { useState, useEffect, useCallback, useRef } from 'react'
import { mediaUrl } from '../api'

export default function PreviewModal({ items, onClose }) {
  const [index, setIndex] = useState(0)
  const [showHint, setShowHint] = useState(true)
  const timerRef = useRef(null)

  const current = items[index]

  const next = useCallback(() => {
    setIndex(i => (i + 1) % items.length)
  }, [items.length])

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Hide hint after 3s
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // Auto-advance images
  useEffect(() => {
    if (!current) return
    if (current.type !== 'image') return
    const duration = (current.display_duration_seconds || 10) * 1000
    timerRef.current = setTimeout(next, duration)
    return () => clearTimeout(timerRef.current)
  }, [index, current, next])

  if (!current) return null

  const src = mediaUrl(current.filename)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {current.type === 'image' && (
        <img
          key={src}
          src={src}
          alt=""
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          onClick={e => e.stopPropagation()}
        />
      )}
      {current.type === 'video' && (
        <video
          key={src}
          src={src}
          autoPlay
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onEnded={next}
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* Hint ESC */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)',
        padding: '6px 16px', borderRadius: 8, fontSize: 13,
        transition: 'opacity 0.5s', opacity: showHint ? 1 : 0, pointerEvents: 'none',
      }}>
        ESC sau click în afară pentru a ieși
      </div>

      {/* Counter + navigation */}
      {items.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + items.length) % items.length) }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>
            ‹
          </button>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {index + 1} / {items.length} · {current.original_name}
          </span>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>
            ›
          </button>
        </div>
      )}
    </div>
  )
}
