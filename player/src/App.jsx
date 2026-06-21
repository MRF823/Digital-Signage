import { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { usePlaylist } from './usePlaylist'
import { useMediaCache } from './useMediaCache'
import VideoPlayer from './components/VideoPlayer'
import ImageDisplay from './components/ImageDisplay'

export default function App() {
  const { playlist, update } = usePlaylist()
  const { urls, ready, cachePlaylist } = useMediaCache()
  const [index, setIndex] = useState(0)

  const onMessage = useCallback((msg) => {
    if (msg.type === 'playlist_update') {
      update(msg.items)
      cachePlaylist(msg.items)
    }
  }, [update, cachePlaylist])

  useWebSocket(onMessage)

  useEffect(() => {
    if (playlist.length > 0) cachePlaylist(playlist)
  }, [])

  const next = useCallback(() => {
    setIndex(i => (i + 1) % Math.max(playlist.length, 1))
  }, [playlist.length])

  if (!ready || playlist.length === 0) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>Conectare...</p>
      </div>
    )
  }

  const current = playlist[index % playlist.length]
  const src = urls[current?.filename]

  if (!src) {
    next()
    return null
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {current.type === 'video' ? (
        <VideoPlayer src={src} onEnded={next} />
      ) : (
        <ImageDisplay src={src} duration={current.display_duration_seconds} onEnded={next} />
      )}
    </div>
  )
}
