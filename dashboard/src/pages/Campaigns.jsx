import { useState, useEffect } from 'react'
import { getCampaigns, createCampaign, deleteCampaign, getAgencies, getGroups, getMedia, mediaUrl } from '../api'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [agencies, setAgencies] = useState([])
  const [groups, setGroups] = useState([])
  const [media, setMedia] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    items: [],
    selectedAgencyIds: new Set(),
  })

  const load = async () => {
    const [c, a, g, m] = await Promise.all([getCampaigns(), getAgencies(), getGroups(), getMedia()])
    setCampaigns(c)
    setAgencies(a)
    setGroups(g)
    setMedia(m)
  }

  useEffect(() => { load() }, [])

  const toggleAgency = (agencyId) => {
    setForm(f => {
      const s = new Set(f.selectedAgencyIds)
      s.has(agencyId) ? s.delete(agencyId) : s.add(agencyId)
      return { ...f, selectedAgencyIds: s }
    })
  }

  const toggleGroup = (group) => {
    const groupAgencyIds = group.agencies.map(a => a.id)
    const allSelected = groupAgencyIds.every(id => form.selectedAgencyIds.has(id))
    setForm(f => {
      const s = new Set(f.selectedAgencyIds)
      if (allSelected) {
        groupAgencyIds.forEach(id => s.delete(id))
      } else {
        groupAgencyIds.forEach(id => s.add(id))
      }
      return { ...f, selectedAgencyIds: s }
    })
  }

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
    if (!form.name || !form.start_date || !form.end_date) return setError('Completează toate câmpurile obligatorii.')
    if (form.selectedAgencyIds.size === 0) return setError('Selectează cel puțin o agenție sau regiune.')
    if (form.items.length === 0) return setError('Selectează cel puțin un fișier media.')
    if (form.start_date > form.end_date) return setError('Data de start trebuie să fie înainte de data de stop.')

    setSaving(true)
    try {
      await Promise.all(
        [...form.selectedAgencyIds].map(agencyId =>
          createCampaign({ name: form.name, agency_id: agencyId, start_date: form.start_date, end_date: form.end_date, items: form.items })
        )
      )
      setSuccess(`Campanie creată pentru ${form.selectedAgencyIds.size} agenție(nții)!`)
      setForm({ name: '', start_date: '', end_date: '', items: [], selectedAgencyIds: new Set() })
      setShowForm(false)
      load()
    } catch (e) {
      setError(e.response?.data?.error || 'Eroare la creare campanie.')
    }
    setSaving(false)
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

  // Grupare campanii după nume + date (aceeași campanie pe mai multe agenții)
  const groupedCampaigns = []
  const seen = new Map()
  for (const c of campaigns) {
    const key = `${c.name}||${c.start_date}||${c.end_date}`
    if (seen.has(key)) {
      seen.get(key).agencies.push(c.agency_name)
      seen.get(key).ids.push(c.id)
    } else {
      const entry = { ...c, agencies: [c.agency_name], ids: [c.id] }
      seen.set(key, entry)
      groupedCampaigns.push(entry)
    }
  }

  // Agenții care nu sunt în niciun grup
  const groupedAgencyIds = new Set(groups.flatMap(g => g.agencies.map(a => a.id)))
  const ungroupedAgencies = agencies.filter(a => !groupedAgencyIds.has(a.id))

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume campanie *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Campanie iulie 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
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

          {/* Selectare regiuni / agenții */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Regiuni / Agenții *
              {form.selectedAgencyIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-normal text-xs">{form.selectedAgencyIds.size} selectate</span>
              )}
            </label>
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {groups.map(group => {
                const groupAgencyIds = group.agencies.map(a => a.id)
                const allSelected = groupAgencyIds.length > 0 && groupAgencyIds.every(id => form.selectedAgencyIds.has(id))
                const someSelected = groupAgencyIds.some(id => form.selectedAgencyIds.has(id))
                return (
                  <div key={group.id}>
                    {/* Header grup */}
                    <label className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={() => toggleGroup(group)}
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-700">{group.name}</span>
                      <span className="text-xs text-gray-400">{group.agencies.length} agenții</span>
                    </label>
                    {/* Agențiile din grup */}
                    <div className="divide-y divide-gray-50">
                      {group.agencies.map(ga => {
                        const agency = agencies.find(a => a.id === ga.id)
                        return (
                          <label key={ga.id} className="flex items-center gap-3 px-8 py-2 cursor-pointer hover:bg-blue-50">
                            <input
                              type="checkbox"
                              checked={form.selectedAgencyIds.has(ga.id)}
                              onChange={() => toggleAgency(ga.id)}
                              className="accent-blue-600 w-3.5 h-3.5"
                            />
                            <span className="text-sm text-gray-600">{ga.name}</span>
                            {agency?.city && <span className="text-xs text-gray-400">{agency.city}</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {ungroupedAgencies.map(a => (
                <label key={a.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-blue-50">
                  <input
                    type="checkbox"
                    checked={form.selectedAgencyIds.has(a.id)}
                    onChange={() => toggleAgency(a.id)}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">{a.name}</span>
                  <span className="text-xs text-gray-400">{a.city}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Selectare media */}
          <div className="mb-5">
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
            <button type="submit" disabled={saving}
              className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 text-sm disabled:opacity-60">
              {saving ? 'Se salvează...' : 'Salvează campania'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm">
              Anulează
            </button>
          </div>
        </form>
      )}

      {groupedCampaigns.length === 0 ? (
        <p className="text-gray-400 text-center py-16">Nicio campanie. Creează prima campanie!</p>
      ) : (
        <div className="space-y-3">
          {groupedCampaigns.map(c => (
            <div key={c.ids[0]} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  {statusBadge(c)}
                </div>
                <p className="text-sm text-gray-500">
                  {c.start_date} → {c.end_date} · {c.items.length} fișiere
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.agencies.map((name, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">{name}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => Promise.all(c.ids.map(id => handleDelete(id)))}
                className="text-red-500 hover:text-red-700 text-sm px-3 py-1 rounded-lg hover:bg-red-50 flex-shrink-0">
                Șterge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
