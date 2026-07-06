import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getAgencies, updateAgencyCoords } from '../api'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function onlineIcon(online) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${online ? '#22c55e' : '#ef4444'};
      border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4)
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  })
}

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + (tv.last_seen_at.includes('Z') ? '' : 'Z')).getTime() < 60_000
}

function RecenterButton({ center }) {
  const map = useMap()
  return (
    <button
      onClick={() => map.setView(center, 7)}
      style={{ position: 'absolute', top: 80, right: 10, zIndex: 1000 }}
      className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 shadow hover:bg-gray-50">
      Centrează România
    </button>
  )
}

export default function MapPage() {
  const [agencies, setAgencies] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editCoords, setEditCoords] = useState({ lat: '', lng: '' })
  const [saving, setSaving] = useState(false)

  const load = () => getAgencies().then(setAgencies).catch(() => {})

  useEffect(() => {
    load()
    const i = setInterval(load, 15_000)
    return () => clearInterval(i)
  }, [])

  const handleSaveCoords = async (agencyId) => {
    const lat = parseFloat(editCoords.lat)
    const lng = parseFloat(editCoords.lng)
    if (isNaN(lat) || isNaN(lng)) return
    setSaving(true)
    await updateAgencyCoords(agencyId, lat, lng).catch(() => {})
    setSaving(false)
    setEditingId(null)
    load()
  }

  const agenciesWithCoords = agencies.filter(a => a.lat != null && a.lng != null)
  const agenciesWithoutCoords = agencies.filter(a => a.lat == null || a.lng == null)

  const allTvs = agencies.flatMap(a => a.tvs)
  const onlineCount = allTvs.filter(isOnline).length
  const offlineCount = allTvs.length - onlineCount

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Hartă locații</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="text-green-600 font-medium">{onlineCount} online</span>
            {' · '}
            <span className="text-red-500 font-medium">{offlineCount} offline</span>
            {' · '}
            {agencies.length} agenții
          </p>
        </div>
      </div>

      {/* Hartă */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-6" style={{ height: 480, position: 'relative' }}>
        <MapContainer
          center={[45.9432, 24.9668]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterButton center={[45.9432, 24.9668]} />
          {agenciesWithCoords.map(agency => {
            const tvOnline = agency.tvs.some(isOnline)
            return (
              <Marker
                key={agency.id}
                position={[agency.lat, agency.lng]}
                icon={onlineIcon(tvOnline)}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 700, marginBottom: 4 }}>{agency.name}</p>
                    <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>{agency.city}</p>
                    {agency.tvs.map(tv => {
                      const on = isOnline(tv)
                      return (
                        <div key={tv.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: on ? '#22c55e' : '#ef4444',
                            display: 'inline-block', flexShrink: 0
                          }} />
                          <span style={{ fontSize: 12 }}>{tv.label} — {on ? 'Online' : 'Offline'}</span>
                        </div>
                      )
                    })}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Legendă */}
      <div className="flex gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block border-2 border-white shadow" />
          <span className="text-gray-600">Cel puțin un TV online</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block border-2 border-white shadow" />
          <span className="text-gray-600">Toate TV-urile offline</span>
        </div>
      </div>

      {/* Agenții fără coordonate */}
      {agenciesWithoutCoords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            Agenții fără coordonate ({agenciesWithoutCoords.length})
          </p>
          <div className="flex flex-col gap-2">
            {agenciesWithoutCoords.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-white rounded-lg border px-3 py-2">
                <span className="text-sm text-gray-700 flex-1">{a.name} · {a.city}</span>
                {editingId === a.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Lat (ex: 44.42)"
                      value={editCoords.lat}
                      onChange={e => setEditCoords(c => ({ ...c, lat: e.target.value }))}
                      className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      placeholder="Lng (ex: 26.10)"
                      value={editCoords.lng}
                      onChange={e => setEditCoords(c => ({ ...c, lng: e.target.value }))}
                      className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button onClick={() => handleSaveCoords(a.id)} disabled={saving}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                      Salvează
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                      Anulează
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingId(a.id); setEditCoords({ lat: '', lng: '' }) }}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded">
                    + Adaugă coordonate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
