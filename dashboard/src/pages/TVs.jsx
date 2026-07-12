import { useState, useEffect } from 'react'
import { getAgencies, getGroups } from '../api'

function isOnline(tv) {
  if (!tv.last_seen_at) return false
  return Date.now() - new Date(tv.last_seen_at + 'Z').getTime() < 60_000
}

function formatLastSeen(dateStr) {
  if (!dateStr) return { line1: 'Niciodată', line2: null }
  const date = new Date(dateStr + 'Z')
  const diff = Date.now() - date.getTime()
  const line2 = date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  if (diff < 60_000) return { line1: 'Acum', line2 }
  if (diff < 3_600_000) return { line1: `${Math.round(diff / 60_000)} min`, line2 }
  if (diff < 86_400_000) return { line1: `${Math.round(diff / 3_600_000)} ore`, line2 }
  return { line1: `${Math.round(diff / 86_400_000)} zile`, line2 }
}

const IconMonitor = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconFilm = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.5"/>
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
  </svg>
)
const IconGroup = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconLocation = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
)
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

export default function TVs() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const load = () =>
    Promise.all([getAgencies(), getGroups()]).then(([agencies, groups]) => {
      const groupMap = {}
      const groupHasPlaylist = {}
      groups.forEach(g => {
        g.agencies.forEach(a => { groupMap[a.id] = g.name })
        groupHasPlaylist[g.name] = (g.playlist?.length ?? 0) > 0
      })
      const all = agencies.flatMap(a => {
        const group_name = groupMap[a.id] || null
        const playlist_count = a.playlist?.length ?? 0
        const has_content = group_name ? (groupHasPlaylist[group_name] ?? false) : playlist_count > 0
        return a.tvs.map(tv => ({
          ...tv,
          agency_id: a.id,
          agency_name: a.name,
          city: a.city,
          group_name,
          playlist_count,
          has_content,
        }))
      })
      setRows(all)
    })

  useEffect(() => {
    load()
    const i = setInterval(load, 15_000)
    return () => clearInterval(i)
  }, [])

  const online = rows.filter(isOnline).length
  const offline = rows.length - online
  const noContent = rows.filter(r => !r.has_content).length

  const q = search.toLowerCase()
  const filtered = rows
    .filter(tv => {
      if (filter === 'online') return isOnline(tv)
      if (filter === 'offline') return !isOnline(tv)
      if (filter === 'no_content') return !tv.has_content
      return true
    })
    .filter(tv =>
      !q ||
      tv.label.toLowerCase().includes(q) ||
      tv.agency_name.toLowerCase().includes(q) ||
      (tv.city || '').toLowerCase().includes(q) ||
      (tv.group_name || '').toLowerCase().includes(q)
    )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">TV-uri</h2>
          <p className="text-sm text-gray-400 mt-0.5">Toate ecranele înregistrate · actualizat la 15s</p>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { key: 'all', label: `Toate (${rows.length})`, color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
          { key: 'online', label: `Online (${online})`, dot: 'bg-green-500', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
          { key: 'offline', label: `Offline (${offline})`, dot: 'bg-red-400', color: 'bg-red-50 text-red-600 hover:bg-red-100' },
          { key: 'no_content', label: `Fără conținut (${noContent})`, dot: 'bg-amber-400', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border
              ${filter === f.key ? 'ring-2 ring-offset-1 ring-blue-400 border-blue-200' : 'border-transparent'}
              ${f.color}`}
          >
            {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
            {f.label}
          </button>
        ))}

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută TV, agenție, grup..."
          className="ml-auto px-4 py-2 border border-gray-200 rounded-full text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Denumire</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Agenție</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Grup</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Conținut</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">Ultima activitate</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <IconMonitor />
                    <span>Niciun TV găsit</span>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(tv => {
              const on = isOnline(tv)
              const { line1, line2 } = formatLastSeen(tv.last_seen_at)
              const isExp = expanded === tv.id

              return (
                <tr
                  key={tv.id}
                  className={`transition-colors ${on ? 'hover:bg-gray-50' : 'bg-red-50/30 hover:bg-red-50/60'}`}
                >
                  {/* Denumire */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${on ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-400'}`}>
                        <IconMonitor />
                      </div>
                      <span className="font-semibold text-gray-800">{tv.label}</span>
                    </div>
                  </td>

                  {/* Agenție */}
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-1.5">
                      <span className="text-gray-400 mt-0.5 flex-shrink-0"><IconLocation /></span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-700">{tv.agency_name}</p>
                          <span className="text-xs font-mono bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">ID:{tv.agency_id}</span>
                        </div>
                        {tv.city && <p className="text-xs text-gray-400">{tv.city}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Grup */}
                  <td className="px-5 py-4">
                    {tv.group_name ? (
                      <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        <IconGroup />
                        {tv.group_name}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Conținut */}
                  <td className="px-5 py-4">
                    {!tv.has_content ? (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        Fără conținut
                      </span>
                    ) : tv.group_name ? (
                      <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-600 border border-purple-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        <IconFilm />
                        Din grup
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full text-xs font-medium">
                        <IconFilm />
                        {tv.playlist_count} fișier{tv.playlist_count !== 1 ? 'e' : ''}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${on ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`} />
                      {on ? 'Online' : 'Offline'}
                    </span>
                  </td>

                  {/* Ultima activitate */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-700">{line1}</p>
                    {line2 && <p className="text-xs text-gray-400">{line2}</p>}
                  </td>

                  {/* Acțiuni */}
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setExpanded(isExp ? null : tv.id)}
                      className="text-gray-300 hover:text-blue-500 transition-colors"
                      title="Detalii"
                    >
                      <IconInfo />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Total */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right mt-3">{filtered.length} TV{filtered.length !== 1 ? '-uri' : ''} afișate</p>
      )}
    </div>
  )
}
