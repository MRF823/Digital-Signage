import { useState, useCallback, useEffect, useRef } from 'react'
import { useWebSocket } from './useWebSocket'
import { usePlaylist } from './usePlaylist'
import { useMediaCache } from './useMediaCache'
import VideoPlayer from './components/VideoPlayer'
import ImageDisplay from './components/ImageDisplay'
import Ticker from './components/Ticker'
import './transitions.css'

const EXIT_MS = 350

function toLocalISO(date) {
  const off = date.getTimezoneOffset()
  const local = new Date(date.getTime() - off * 60000)
  return local.toISOString().slice(0, 19)
}

export default function App() {
  const { playlist, update } = usePlaylist()
  const { urls, ready, cachePlaylist } = useMediaCache()
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [playCount, setPlayCount] = useState(0)
  const [ratesData, setRatesData] = useState(null)
  const playedAtRef = useRef(toLocalISO(new Date()))
  const [animClass, setAnimClass] = useState('')
  const [transitionType, setTransitionType] = useState('fade')
  const [screenOn, setScreenOn] = useState(true)
  const fadingRef = useRef(false)
  const sendRef = useRef(() => {})
  const playCountRef = useRef(0)
  const cursorTimerRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const showCursor = () => {
      document.body.classList.remove('hide-cursor')
      clearTimeout(cursorTimerRef.current)
      cursorTimerRef.current = setTimeout(() => {
        document.body.classList.add('hide-cursor')
      }, 3000)
    }
    document.addEventListener('mousemove', showCursor)
    cursorTimerRef.current = setTimeout(() => {
      document.body.classList.add('hide-cursor')
    }, 3000)
    return () => {
      document.removeEventListener('mousemove', showCursor)
      clearTimeout(cursorTimerRef.current)
      document.body.classList.remove('hide-cursor')
    }
  }, [])

  const advance = useCallback((sendLog = true) => {
    if (fadingRef.current) return
    fadingRef.current = true

    const current = playlist[indexRef.current % Math.max(playlist.length, 1)]
    if (current && sendLog) {
      const durationSeconds = Math.round((Date.now() - new Date(playedAtRef.current).getTime()) / 1000)
      sendRef.current({
        type: 'play_log',
        filename: current.filename,
        original_name: current.original_name,
        media_type: current.type,
        played_at: playedAtRef.current,
        duration_seconds: durationSeconds,
      })
    }

    playCountRef.current += 1
    setPlayCount(playCountRef.current)

    const type = transitionType
    if (type === 'none') {
      playedAtRef.current = toLocalISO(new Date())
      setIndex(i => {
        const n = (i + 1) % Math.max(playlist.length, 1)
        indexRef.current = n
        return n
      })
      fadingRef.current = false
      return
    }

    setAnimClass(`t-exit-${type}`)
    setTimeout(() => {
      playedAtRef.current = toLocalISO(new Date())
      setIndex(i => {
        const n = (i + 1) % Math.max(playlist.length, 1)
        indexRef.current = n
        return n
      })
      setAnimClass(`t-enter-${type}`)
      setTimeout(() => {
        setAnimClass('')
        fadingRef.current = false
      }, EXIT_MS)
    }, EXIT_MS)
  }, [playlist, transitionType])

  const next = useCallback(() => advance(true), [advance])

  const onMessage = useCallback((msg) => {
    if (msg.type === 'playlist_update') {
      update(msg.items)
      cachePlaylist(msg.items)
      if (msg.transition) setTransitionType(msg.transition)
    }
    if (msg.type === 'rates_update') {
      setRatesData({ rates: msg.rates, updatedAt: msg.updatedAt })
    }
    if (msg.type === 'sync_advance') {
      advance(false)
    }
    if (msg.type === 'screen_power') {
      setScreenOn(msg.on)
    }
    if (msg.type === 'reload') {
      window.location.reload()
    }
  }, [update, cachePlaylist, advance])

  const { connected, send } = useWebSocket(onMessage)

  useEffect(() => {
    sendRef.current = send
  }, [send])

  useEffect(() => {
    if (playlist.length > 0) cachePlaylist(playlist)
  }, [])

  if (!ready || playlist.length === 0) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
          {connected ? 'Se încarcă...' : 'Conectare...'}
        </p>
      </div>
    )
  }

  const current = playlist[index % playlist.length]
  const src = urls[current?.filename]
  const tickerHeight = ratesData ? 88 : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'fixed', top: 12, left: 12, zIndex: 200,
        background: 'rgba(0,0,0,0.5)', borderRadius: '6px',
        padding: '3px 8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)',
        fontFamily: 'monospace',
      }}>Player · :{window.location.port}</div>
      {!connected && (
        <div style={{
          position: 'fixed', top: 12, right: 12, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', borderRadius: '6px',
          padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Offline — din cache</span>
        </div>
      )}
      <div
        className={animClass}
        style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
      >
        {src && current.type === 'video' && <VideoPlayer key={playCount} src={src} onEnded={next} />}
        {src && current.type === 'image' && <ImageDisplay key={playCount} src={src} duration={current.display_duration_seconds} onEnded={next} />}
      </div>
      {ratesData && <Ticker rates={ratesData?.rates} updatedAt={ratesData?.updatedAt} />}
      {!screenOn && (
        <div style={{
          position: 'fixed', inset: 0, background: 'black', zIndex: 9999,
          transition: 'opacity 1s ease',
        }} />
      )}
    </div>
  )
}
