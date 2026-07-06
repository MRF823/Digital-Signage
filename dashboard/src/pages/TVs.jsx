import { useState, useEffect } from 'react'
import { getAgencies } from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return 'Niciodată'
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  if (diff < 60_000) return 'Acum < 1min'
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}min în urmă`
  return `${Math.round(diff / 3_600_000)}h în urmă`
}

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

export default function TVs() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  const load = () =>
    getAgencies().then(agencies =>
      setRows(agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name, city: a.city }))))
    )

  useEffect(() => {
    load()
    const interval = setInterval(load, 15_000)
    return () => clearInterval(interval)
  }, [])

  const online = rows.filter(isOnline).length
  const offline = rows.length - online

  const q = search.toLowerCase()
  const filtered = rows.filter(tv =>
    !q ||
    tv.label.toLowerCase().includes(q) ||
    tv.agency_name.toLowerCase().includes(q) ||
    tv.city.toLowerCase().includes(q) ||
    (tv.ip_address || '').includes(q)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">TV-uri ({rows.length})</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-green-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {online} online
          </span>
          <span className="flex items-center gap-1.5 text-red-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            {offline} offline
          </span>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută după TV, agenție, oraș sau IP..."
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {['Status', 'TV', 'Agenție', 'Oraș', 'IP', 'Ultima activitate'].map(h => (
                <th key={h} className="text-left px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Niciun rezultat</td></tr>
            )}
            {filtered.map(tv => {
              const online = isOnline(tv)
              return (
                <tr key={tv.id} className={`border-t hover:bg-gray-50 ${!online ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full
                      ${online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{tv.label}</td>
                  <td className="px-4 py-3 text-gray-600">{tv.agency_name}</td>
                  <td className="px-4 py-3 text-gray-500">{tv.city}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{tv.ip_address || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{timeAgo(tv.last_seen_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
