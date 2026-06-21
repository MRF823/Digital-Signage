import { useEffect } from 'react'

const DEFAULT_DURATION_MS = 10_000

export default function ImageDisplay({ src, duration, onEnded }) {
  useEffect(() => {
    const ms = duration ? duration * 1000 : DEFAULT_DURATION_MS
    const t = setTimeout(onEnded, ms)
    return () => clearTimeout(t)
  }, [src, duration, onEnded])

  return (
    <img
      key={src}
      src={src}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'black' }}
    />
  )
}
