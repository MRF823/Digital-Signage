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

  const load = () =>
    getAgencies().then(agencies =>
      setRows(agencies.flatMap(a => a.tvs.map(tv => ({ ...tv, agency_name: a.name, city: a.city }))))
    )

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">TV-uri ({rows.length})</h2>
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
            {rows.map(tv => (
              <tr key={tv.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`text-lg ${isOnline(tv) ? 'text-green-500' : 'text-gray-300'}`}>●</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{tv.label}</td>
                <td className="px-4 py-3 text-gray-600">{tv.agency_name}</td>
                <td className="px-4 py-3 text-gray-500">{tv.city}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{tv.ip_address || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{timeAgo(tv.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
