import { useRef, useEffect } from 'react'

export default function VideoPlayer({ src, onEnded }) {
  const ref = useRef()

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.play().catch(() => {})
  }, [src])

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      onEnded={onEnded}
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: 'black' }}
    />
  )
}
