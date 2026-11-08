import { useState, useEffect, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { getMedia, uploadMedia, deleteMedia } from '../api'
import MediaCard from '../components/MediaCard'
import PreviewPlayer from '../components/PreviewPlayer'

export default function Content() {
  const [media, setMedia] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const warningTimer = useRef(null)
  const [previewing, setPreviewing] = useState(false)

  const load = () => getMedia().then(setMedia)
  useEffect(() => { load() }, [])

  const checkImageAspectRatio = (file) => new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const ratio = img.width / img.height
      const is16x9 = Math.abs(ratio - 16 / 9) < 0.05
      resolve(is16x9 ? null : `Imaginea are rezoluția ${img.width}×${img.height}. Pentru afișare optimă pe TV, folosește 1920×1080 (16:9).`)
    }
    img.src = URL.createObjectURL(file)
  })

  const onDrop = useCallback(async (files) => {
    setError('')
    setWarning('')
    for (const file of files) {
      const duplicate = media.find(m => m.original_name === file.name)
      if (duplicate) {
        setError(`Fișierul "${file.name}" există deja în librărie. Șterge-l mai întâi dacă vrei să îl înlocuiești.`)
        continue
      }
      const warn = await checkImageAspectRatio(file)
      if (warn) {
        setWarning(warn)
        clearTimeout(warningTimer.current)
        warningTimer.current = setTimeout(() => setWarning(''), 6000)
      }
      setProgress(0)
      try {
        await uploadMedia(file, setProgress)
        await load()
      } catch (e) {
        setError(e.response?.data?.error || 'Upload eșuat.')
      }
    }
    setProgress(null)
  }, [media])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': [], 'image/jpeg': [], 'image/png': [] },
    maxSize: 500 * 1024 * 1024,
  })

  const handleDelete = async (id) => {
    if (!confirm('Ștergi acest fișier?')) return
    await deleteMedia(id)
    setMedia(m => m.filter(f => f.id !== id))
  }

  return (
    <div style={{ padding:24 }}>
      {previewing && <PreviewPlayer items={media} onClose={() => setPreviewing(false)} />}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:22, color:'var(--fg)', margin:0 }}>
            Librărie Media
          </h1>
          <p style={{ fontSize:13, color:'var(--fg-3)', marginTop:3 }}>{media.length} fișiere încărcate</p>
        </div>
        {media.length > 0 && (
          <button onClick={() => setPreviewing(true)}
            style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 16px',
              background:'var(--fg)', color:'var(--surface)', border:'none', borderRadius:8,
              fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Previzualizare
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div {...getRootProps()}
        style={{ border:`2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
          background: isDragActive ? 'rgba(37,99,235,.04)' : 'var(--surface)',
          borderRadius:12, padding:'36px 24px', textAlign:'center', cursor:'pointer',
          marginBottom:20, transition:'all .15s' }}>
        <input {...getInputProps()} />
        <div style={{ fontSize:32, marginBottom:8 }}>⬆️</div>
        <p style={{ fontSize:14, color:'var(--fg-2)', margin:0 }}>
          Trage fișierele aici sau <span style={{ color:'var(--accent)', textDecoration:'underline' }}>alege fișier</span>
        </p>
        <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:6 }}>MP4, JPG, PNG — max 500MB</p>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div style={{ marginBottom:16 }}>
          <div style={{ height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:6, background:'var(--accent)', width:`${progress}%`, transition:'width .2s', borderRadius:99 }} />
          </div>
          <p style={{ fontSize:12, color:'var(--fg-3)', marginTop:5 }}>{progress}% uploadat...</p>
        </div>
      )}

      {/* Warning toast */}
      {warning && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:50, maxWidth:340,
          background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.4)',
          color:'#B45309', fontSize:13, borderRadius:10, padding:'12px 16px',
          boxShadow:'var(--shadow-md)', display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <span style={{ flex:1 }}>{warning}</span>
          <button onClick={() => setWarning('')}
            style={{ fontSize:16, color:'#D97706', background:'none', border:'none', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
      )}

      {error && (
        <p style={{ fontSize:13, color:'#DC2626', marginBottom:14 }}>{error}</p>
      )}

      {/* Media grid */}
      {media.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--fg-3)', fontSize:14 }}>
          Nicio înregistrare media. Încarcă primul fișier!
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:14 }}>
          {media.map(item => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
