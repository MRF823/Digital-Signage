import { useState, useEffect, useRef, useCallback } from 'react'
import { mediaUrl } from '../api'

export default function PreviewPlayer({ items, onClose }) {
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [playing, setPlaying] = useState(true)
  const videoRef = useRef(null)
  const timerRef = useRef(null)

  const item = items[current]

  const goNext = useCallback(() => {
    clearInterval(timerRef.current)
    setCurrent(prev => (prev + 1) % items.length)
  }, [items.length])

  const goPrev = () => {
    clearInterval(timerRef.current)
    setCurrent(prev => (prev - 1 + items.length) % items.length)
  }

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!item) return
    if (item.type === 'image' && playing) {
      const secs = item.display_duration_seconds ?? 10
      setTimeLeft(secs)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); goNext(); return 0 }
          return prev - 1
        })
      }, 1000)
    } else {
      setTimeLeft(null)
    }
    return () => clearInterval(timerRef.current)
  }, [current, playing, goNext])

  useEffect(() => {
    if (!videoRef.current) return
    if (playing) videoRef.current.play().catch(() => {})
    else videoRef.current.pause()
  }, [playing, current])

  const togglePlay = () => {
    setPlaying(p => {
      if (item.type === 'image' && p) clearInterval(timerRef.current)
      return !p
    })
  }

  if (!item) return null

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex-1 flex items-center justify-center relative">
        {item.type === 'video' ? (
          <video
            ref={videoRef}
            key={item.filename}
            src={mediaUrl(item.filename)}
            autoPlay={playing}
            onEnded={goNext}
            className="max-h-full max-w-full"
          />
        ) : (
          <img
            key={item.filename}
            src={mediaUrl(item.filename)}
            alt={item.original_name}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {item.type === 'image' && timeLeft !== null && (
          <div className="absolute top-4 right-4 bg-black/60 text-white text-sm font-bold px-3 py-1.5 rounded-full">
            {timeLeft}s
          </div>
        )}
      </div>

      <div className="bg-black/80 px-6 py-4 flex items-center gap-4">
        <button onClick={goPrev} className="text-white hover:text-blue-400 text-xl px-2">⏮</button>
        <button onClick={togglePlay} className="text-white hover:text-blue-400 text-2xl px-2">
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={goNext} className="text-white hover:text-blue-400 text-xl px-2">⏭</button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
          {items.map((it, i) => (
            <button key={i} onClick={() => { clearInterval(timerRef.current); setCurrent(i) }}
              className={`shrink-0 text-xs px-2 py-1 rounded transition-colors
                ${i === current ? 'bg-blue-600 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}>
              {it.type === 'video' ? '🎬' : '🖼️'} {i + 1}
            </button>
          ))}
        </div>

        <span className="text-white/60 text-xs truncate max-w-48">{item.original_name}</span>

        <button onClick={onClose}
          className="text-white/60 hover:text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg ml-2">
          Închide
        </button>
      </div>
    </div>
  )
}
