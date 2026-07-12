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
      resolve(is16x9 ? null : `⚠️ Imaginea are rezoluția ${img.width}×${img.height}. Pentru afișare optimă pe TV, folosește 1920×1080 (16:9).`)
    }
    img.src = URL.createObjectURL(file)
  })

  const onDrop = useCallback(async (files) => {
    setError('')
    setWarning('')
    for (const file of files) {
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
  }, [])

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
    <div>
      {previewing && <PreviewPlayer items={media} onClose={() => setPreviewing(false)} />}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Conținut Media</h2>
        {media.length > 0 && (
          <button onClick={() => setPreviewing(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Previzualizare
          </button>
        )}
      </div>

      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer mb-6 transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`}>
        <input {...getInputProps()} />
        <p className="text-3xl mb-2">⬆️</p>
        <p className="text-gray-500">Trage fișierele aici sau <span className="text-blue-600 underline">alege fișier</span></p>
        <p className="text-xs text-gray-400 mt-1">MP4, JPG, PNG — max 500MB</p>
      </div>

      {progress !== null && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-2 bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}% uploadat...</p>
        </div>
      )}

      {warning && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-xl px-4 py-3 shadow-lg flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <span>{warning.replace('⚠️ ', '')}</span>
          <button onClick={() => setWarning('')} className="ml-auto text-amber-400 hover:text-amber-600 text-lg leading-none">×</button>
        </div>
      )}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {media.length === 0 ? (
        <p className="text-gray-400 text-center py-10">Nicio înregistrare media. Încarcă primul fișier!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map(item => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
