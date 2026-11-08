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

  const inp = (w) => ({ height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:8,
    background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', width: w })

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:800, fontSize:22, color:'var(--fg)', margin:0 }}>
            Agenții
          </h1>
          <p style={{ fontSize:13, color:'var(--fg-3)', marginTop:3 }}>{agencies.length} agenții înregistrate</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 16px',
            background:'var(--accent)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Agenție nouă
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleCreate}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
            padding:16, marginBottom:16, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end',
            boxShadow:'var(--shadow-sm)' }}>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', marginBottom:4, fontWeight:600 }}>Nume agenție</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder='"Agenția Floreasca"' style={inp(200)} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', marginBottom:4, fontWeight:600 }}>Oraș</label>
            <input value={newCity} onChange={e => setNewCity(e.target.value)}
              placeholder='"București"' style={inp(140)} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, color:'var(--fg-3)', marginBottom:4, fontWeight:600 }}>
              Adresă <span style={{ fontWeight:400, color:'var(--fg-3)' }}>(hartă)</span>
            </label>
            <input value={newAddress} onChange={e => setNewAddress(e.target.value)}
              placeholder='"Str. Victoriei 10, București"' style={inp(260)} />
          </div>
          <button type="submit" disabled={geocoding}
            style={{ height:36, padding:'0 16px', background:'var(--accent)', color:'#fff', border:'none',
              borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity:geocoding?.6:1 }}>
            {geocoding ? 'Se caută...' : 'Creează'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            style={{ fontSize:13, color:'var(--fg-3)', background:'none', border:'none', cursor:'pointer' }}>
            Anulează
          </button>
          {formError && <p style={{ fontSize:12, color:'#DC2626', width:'100%', margin:0 }}>{formError}</p>}
        </form>
      )}

      {/* Search */}
      <div style={{ marginBottom:16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută agenție, oraș, adresă..."
          style={{ width:'100%', height:38, padding:'0 16px', border:'1px solid var(--border)', borderRadius:99,
            background:'var(--surface)', color:'var(--fg)', fontSize:13, outline:'none', boxSizing:'border-box' }}
        />
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(480px, 1fr))', gap:16 }}>
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
