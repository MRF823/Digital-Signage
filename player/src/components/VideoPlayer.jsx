export default function VideoPlayer({ src, onEnded }) {
  return (
    <video
      key={src}
      src={src}
      autoPlay
      muted
      onEnded={onEnded}
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: 'black' }}
    />
  )
}
