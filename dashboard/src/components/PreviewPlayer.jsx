import { useState, useEffect, useRef, useCallback } from 'react'
import { mediaUrl, getRates } from '../api'

const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

function Ticker({ rates, updatedAt }) {
  if (!rates) return null

  const ratesDate = updatedAt ? new Date(updatedAt) : null
  const time = ratesDate
    ? ratesDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null
  const date = ratesDate
    ? ratesDate.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  const TimeBlock = () => time ? (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px', borderLeft: '1px solid rgba(0,0,0,0.06)',
      textAlign: 'center', flexShrink: 0, marginLeft: 'auto',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{time}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{date}</div>
    </div>
  ) : null

  const s = {
    wrap: {
      background: '#fff', borderTop: '1px solid rgba(0,0,0,0.08)',
      fontFamily: 'system-ui, -apple-system, sans-serif', flexShrink: 0,
      display: 'flex',
    },
    rows: { flex: 1, overflow: 'hidden' },
    row: (bg) => ({
      display: 'flex', alignItems: 'center', padding: '7px 20px',
      background: bg,
      borderBottom: bg === '#fff' ? '1px solid rgba(0,0,0,0.06)' : 'none',
    }),
    label: (color) => ({ fontSize: 11, fontWeight: 600, color, width: 72, flexShrink: 0, letterSpacing: '0.05em' }),
    cell: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderLeft: '1px solid rgba(0,0,0,0.06)' },
    cur: { fontSize: 12, fontWeight: 600, color: '#374151', width: 26 },
    tag: { fontSize: 10, color: '#9ca3af' },
    val: () => ({ fontSize: 15, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }),
    dash: { fontSize: 15, color: '#d1d5db' },
  }

  return (
    <div style={s.wrap}>
        <div style={s.row('#fff')}>
          <span style={{ ...s.label('#16a34a'), fontSize: 13 }}>CEC BANK</span>
          {CURRENCIES.map(c => {
            const r = rates[c]
            const hasBuySell = r?.buy != null || r?.sell != null
            return (
              <div key={c} style={s.cell}>
                <span style={s.cur}>{c}</span>
                {hasBuySell ? (
                  <>
                    <span style={s.tag}>cmp</span>
                    <span style={s.val('#0F6E56')}>{r.buy?.toFixed(4) ?? '—'}</span>
                    <span style={{ fontSize: 12, color: '#d1d5db' }}>/</span>
                    <span style={s.tag}>vnd</span>
                    <span style={s.val('#993C1D')}>{r.sell?.toFixed(4) ?? '—'}</span>
                  </>
                ) : (
                  <span style={s.dash}>—</span>
                )}
              </div>
            )
          })}
          <TimeBlock />
        </div>
        <div style={s.row('#fafaf9')}>
          <span style={s.label('#854F0B')}>BNR REF.</span>
          {CURRENCIES.map(c => (
            <div key={c} style={s.cell}>
              <span style={s.cur}>{c}</span>
              {rates[c]?.reference != null
                ? <span style={s.val('#854F0B')}>{rates[c].reference.toFixed(4)}</span>
                : <span style={s.dash}>—</span>
              }
            </div>
          ))}
          <TimeBlock />
        </div>
    </div>
  )
}

export default function PreviewPlayer({ items, onClose }) {
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(null)
  const [playing, setPlaying] = useState(true)
  const [ratesData, setRatesData] = useState(null)
  const videoRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    getRates().then(data => { if (data?.rates) setRatesData(data) }).catch(() => {})
  }, [])

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
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 0 }}>
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

      <Ticker rates={ratesData?.rates} updatedAt={ratesData?.updatedAt} />

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
          ESC / Închide
        </button>
      </div>
    </div>
  )
}
