import { useState, useEffect } from 'react'
import { getAgencies, getPlaylist, createAgency, getGroups } from '../api'
import AgencyCard from '../components/AgencyCard'

export default function Agencies() {
  const [agencies, setAgencies] = useState([])
  const [agencyGroupMap, setAgencyGroupMap] = useState({})
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [formError, setFormError] = useState('')
  const [geocoding, setGeocoding] = useState(false)

  const load = async () => {
    const [list, groups] = await Promise.all([getAgencies(), getGroups()])
    const withPlaylists = await Promise.all(
      list.map(async a => ({ ...a, playlist: await getPlaylist(a.id) }))
    )
    setAgencies(withPlaylists)
    const map = {}
    for (const g of groups) {
      for (const a of g.agencies) {
        map[a.id] = g.name
      }
    }
    setAgencyGroupMap(map)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!newName.trim() || !newCity.trim()) return setFormError('Completează numele și orașul.')
    setGeocoding(!!newAddress.trim())
    try {
      await createAgency(newName.trim(), newCity.trim(), newAddress.trim())
      setNewName('')
      setNewCity('')
      setNewAddress('')
      setShowForm(false)
      await load()
    } catch (err) {
      setFormError(err?.response?.data?.error || 'Eroare la creare agenție.')
    }
    setGeocoding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Agenții ({agencies.length})</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Agenție nouă
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-white border border-blue-100 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end shadow-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nume agenție</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='ex: "Agenția Floreasca"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Oraș</label>
            <input value={newCity} onChange={e => setNewCity(e.target.value)}
              placeholder='ex: "București"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-40" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Adresă <span className="text-gray-400">(pentru hartă)</span></label>
            <input value={newAddress} onChange={e => setNewAddress(e.target.value)}
              placeholder='ex: "Str. Victoriei 10, București"'
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-72" />
          </div>
          <button type="submit" disabled={geocoding}
            className="bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-60">
            {geocoding ? 'Se caută pe hartă...' : 'Creează'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="text-sm text-gray-400 hover:text-gray-600">
            Anulează
          </button>
          {formError && <p className="text-xs text-red-500 w-full">{formError}</p>}
        </form>
      )}

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută agenție, oraș, adresă..."
          className="w-full border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agencies
          .filter(a => {
            const q = search.toLowerCase()
            return !q ||
              a.name.toLowerCase().includes(q) ||
              a.city.toLowerCase().includes(q) ||
              (a.address || '').toLowerCase().includes(q)
          })
          .map(agency => (
            <AgencyCard
              key={agency.id}
              agency={agency}
              groupName={agencyGroupMap[agency.id] || null}
              onPlaylistSaved={load}
              onDeleted={load}
            />
          ))}
      </div>
    </div>
  )
}
