import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { getMedia, uploadMedia, deleteMedia } from '../api'
import MediaCard from '../components/MediaCard'

export default function Content() {
  const [media, setMedia] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')

  const load = () => getMedia().then(setMedia)
  useEffect(() => { load() }, [])

  const onDrop = useCallback(async (files) => {
    setError('')
    for (const file of files) {
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
      <h2 className="text-xl font-bold text-gray-800 mb-4">Conținut Media</h2>

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
