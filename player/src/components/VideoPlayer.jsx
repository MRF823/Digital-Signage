import { useRef, useEffect } from 'react'

export default function VideoPlayer({ src, onEnded, seamless, onLoop }) {
  const ref = useRef()

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.play().catch(() => {})
  }, [src])

  const handleEnded = () => {
    if (seamless) {
      onLoop?.()
      const v = ref.current
      if (v) { v.currentTime = 0; v.play().catch(() => {}) }
      return
    }
    onEnded?.()
  }

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      onEnded={handleEnded}
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: 'black' }}
    />
  )
}
