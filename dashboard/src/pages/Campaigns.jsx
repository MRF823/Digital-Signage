import { useState, useEffect } from 'react'
import { getCampaigns, createCampaign, deleteCampaign, getAgencies, getMedia, mediaUrl } from '../api'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [agencies, setAgencies] = useState([])
  const [media, setMedia] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    agency_id: '',
    name: '',
    start_date: '',
    end_date: '',
    items: [],
  })

  const load = async () => {
    const [c, a, m] = await Promise.all([getCampaigns(), getAgencies(), getMedia()])
    setCampaigns(c)
    setAgencies(a)
    setMedia(m)
  }

  useEffect(() => { load() }, [])

  const toggleMedia = (mediaItem) => {
    const exists = form.items.find(i => i.media_id === mediaItem.id)
    if (exists) {
      setForm(f => ({ ...f, items: f.items.filter(i => i.media_id !== mediaItem.id) }))
    } else {
      setForm(f => ({ ...f, items: [...f.items, { media_id: mediaItem.id, display_duration_seconds: mediaItem.type === 'image' ? 10 : null }] }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.agency_id || !form.name || !form.start_date || !form.end_date) {
      return setError('Completează toate câmpurile obligatorii.')
    }
    if (form.items.length === 0) {
      return setError('Selectează cel puțin un fișier media.')
    }
    if (form.start_date > form.end_date) {
      return setError('Data de start trebuie să fie înainte de data de stop.')
    }
    try {
      await createCampaign({ ...form, agency_id: parseInt(form.agency_id) })
      setSuccess('Campanie creată cu succes!')
      setForm({ agency_id: '', name: '', start_date: '', end_date: '', items: [] })
      setShowForm(false)
      load()
    } catch (e) {
      setError(e.response?.data?.error || 'Eroare la creare campanie.')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Ștergi această campanie?')) return
    await deleteCampaign(id)
    setCampaigns(c => c.filter(x => x.id !== id))
  }

  const today = new Date().toISOString().slice(0, 10)

  const statusBadge = (c) => {
    if (c.end_date < today) return <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Expirată</span>
    if (c.start_date > today) return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Programată</span>
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activă</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Campanii</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 text-sm">
          + Campanie nouă
        </button>
      </div>

      {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded-lg">{success}</p>}
      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">Campanie nouă</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume campanie *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Campanie iulie 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agenție *</label>
              <select value={form.agency_id} onChange={e => setForm(f => ({ ...f, agency_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Selectează agenția</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data start *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data stop *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selectează fișiere media *</label>
            {media.length === 0 ? (
              <p className="text-gray-400 text-sm">Nu există fișiere media. Încarcă mai întâi din pagina Conținut.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {media.map(m => {
                  const selected = form.items.find(i => i.media_id === m.id)
                  return (
                    <div key={m.id} onClick={() => toggleMedia(m)}
                      className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all
                        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-400'}`}>
                      {m.type === 'image'
                        ? <img src={mediaUrl(m.filename)} className="w-full h-16 object-cover" />
                        : <div className="w-full h-16 bg-gray-800 flex items-center justify-center text-white text-xs">▶ Video</div>
                      }
                      <p className="text-xs text-gray-600 p-1 truncate">{m.original_name}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 text-sm">
              Salvează campania
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm">
              Anulează
            </button>
          </div>
        </form>
      )}

      {campaigns.length === 0 ? (
        <p className="text-gray-400 text-center py-16">Nicio campanie. Creează prima campanie!</p>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  {statusBadge(c)}
                </div>
                <p className="text-sm text-gray-500">{c.agency_name} · {c.start_date} → {c.end_date} · {c.items.length} fișiere</p>
              </div>
              <button onClick={() => handleDelete(c.id)}
                className="text-red-500 hover:text-red-700 text-sm px-3 py-1 rounded-lg hover:bg-red-50">
                Șterge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
