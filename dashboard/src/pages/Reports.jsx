import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { getPlayLog, getAgencies, getGroups, getPlaylist, getGroupPlaylist } from '../api'

function fmt(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'Z'))
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function fmtDuration(sec) {
  if (sec == null || sec === 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtDurationLong(sec) {
  if (!sec) return '0s'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function playlistDuration(items) {
  return items.reduce((s, item) => {
    if (item.type === 'video') return s + (item.duration_seconds ?? 0)
    return s + (item.display_duration_seconds ?? 10)
  }, 0)
}

function downloadExcel(logs, agencies, playlists) {
  const agencyMap = {}
  agencies.forEach(a => { agencyMap[a.id] = { name: a.name, city: a.city } })

  // Sheet 1: Sumar per agenție
  const byAgency = {}
  logs.forEach(r => {
    const ag = agencyMap[r.agency_id] ?? { name: `#${r.agency_id}`, city: '' }
    if (!byAgency[r.agency_id]) byAgency[r.agency_id] = { name: ag.name, city: ag.city, plays: 0, total: 0 }
    byAgency[r.agency_id].plays++
    byAgency[r.agency_id].total += r.duration_seconds ?? 0
  })

  const summaryRows = [['Agenție', 'Oraș', 'Total redări', 'Durată totală', 'Durată playlist', 'Cicluri complete']]
  Object.entries(byAgency).forEach(([agId, data]) => {
    const pd = playlists[agId] ? playlistDuration(playlists[agId]) : 0
    const cycles = pd > 0 ? Math.floor(data.total / pd) : '—'
    summaryRows.push([data.name, data.city, data.plays, fmtDurationLong(data.total), fmtDurationLong(pd), cycles])
  })

  // Sheet 2: Detaliat
  const detailRows = [['Data / Ora', 'Agenție', 'TV', 'Fișier', 'Tip', 'Durată']]
  logs.forEach(r => {
    const ag = agencyMap[r.agency_id]
    detailRows.push([
      fmt(r.played_at),
      ag?.name ?? `#${r.agency_id}`,
      r.tv_label,
      r.original_name,
      r.media_type,
      fmtDuration(r.duration_seconds),
    ])
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Sumar')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), 'Detaliat')
  XLSX.writeFile(wb, 'proof-of-play.xlsx')
}

export default function Reports() {
  const [logs, setLogs] = useState([])
  const [agencies, setAgencies] = useState([])
  const [playlists, setPlaylists] = useState({}) // agencyId -> items[]
  const [agencyId, setAgencyId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getAgencies(), getGroups()]).then(async ([ag, groups]) => {
      setAgencies(ag)

      // map agencyId -> groupId
      const agencyGroupId = {}
      groups.forEach(g => g.agencies.forEach(a => { agencyGroupId[a.id] = g.id }))

      // fetch playlist direct per agenție
      const directResults = await Promise.all(
        ag.map(a => getPlaylist(a.id).then(items => ({ id: a.id, items })).catch(() => ({ id: a.id, items: [] })))
      )

      // fetch playlist de grup (o singură dată per grup)
      const groupPlaylistMap = {}
      await Promise.all(
        groups.map(g => getGroupPlaylist(g.id).then(items => { groupPlaylistMap[g.id] = items }).catch(() => {}))
      )

      const map = {}
      directResults.forEach(r => {
        // dacă playlist direct e gol și agenția e în grup → folosește playlist-ul grupului
        if (r.items.length === 0 && agencyGroupId[r.id]) {
          map[r.id] = groupPlaylistMap[agencyGroupId[r.id]] || []
        } else {
          map[r.id] = r.items
        }
      })
      setPlaylists(map)
    }).catch(() => {})
  }, [])

  const load = (opts = {}) => {
    const aid = opts.agencyId !== undefined ? opts.agencyId : agencyId
    const f = opts.from !== undefined ? opts.from : from
    const t = opts.to !== undefined ? opts.to : to
    setLoading(true)
    setError('')
    const params = {}
    if (aid) params.agency_id = aid
    if (f) params.from = new Date(f + 'T00:00:00').toISOString()
    if (t) params.to = new Date(t + 'T23:59:59').toISOString()
    getPlayLog(params)
      .then(data => { setLogs(data); if (data.length === 0) setError('Niciun rezultat pentru filtrele selectate.') })
      .catch(e => { setLogs([]); setError('Eroare la încărcare: ' + (e?.message || 'unknown')) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)

  // Perioada selectată în secunde
  const periodStart = from ? new Date(from + 'T00:00:00') : null
  const periodEnd = to ? new Date(to + 'T23:59:59') : null
  const periodSeconds = (periodStart && periodEnd)
    ? Math.round((periodEnd - periodStart) / 1000)
    : null

  // Stats globale
  const totalDuration = logs.reduce((s, r) => s + (r.duration_seconds ?? 0), 0)
  const uniqueFiles = new Set(logs.map(r => r.filename)).size

  // Per agenție
  const agencyMap = {}
  agencies.forEach(a => { agencyMap[a.id] = a })

  const byAgency = {}
  logs.forEach(r => {
    if (!byAgency[r.agency_id]) byAgency[r.agency_id] = { plays: 0, total: 0 }
    byAgency[r.agency_id].plays++
    byAgency[r.agency_id].total += r.duration_seconds ?? 0
  })

  // Per file breakdown
  const byFile = {}
  logs.forEach(r => {
    if (!byFile[r.original_name]) byFile[r.original_name] = { name: r.original_name, type: r.media_type, plays: 0, total: 0 }
    byFile[r.original_name].plays++
    byFile[r.original_name].total += r.duration_seconds ?? 0
  })
  const fileStats = Object.values(byFile).sort((a, b) => b.total - a.total)
  const maxTotal = fileStats[0]?.total || 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Proof of Play</h2>
          <p className="text-sm text-gray-400 mt-0.5">Istoric redare pe fiecare ecran</p>
        </div>
        <button onClick={() => downloadExcel(logs, agencies, playlists)} disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 shadow-sm">
          ↓ Export Excel
        </button>
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Agenție</label>
          <select value={agencyId} onChange={e => setAgencyId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toate agențiile</option>
            {agencies.map(a => <option key={a.id} value={a.id}>{a.name} · {a.city}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">De la</label>
          <input type="date" value={from} max={today} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Până la</label>
          <input type="date" value={to} max={today} onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => load()} disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
          {loading ? 'Se încarcă...' : 'Filtrează'}
        </button>
        {(agencyId || from || to) && (
          <button onClick={() => {
            setAgencyId(''); setFrom(''); setTo('')
            load({ agencyId: '', from: '', to: '' })
          }} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">
            Resetează
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {error}
        </div>
      )}

      {/* Carduri sumar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Total redări</p>
          <p className="text-3xl font-bold text-gray-800">{logs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Durată totală rulată</p>
          <p className="text-3xl font-bold text-blue-600">{fmtDurationLong(totalDuration)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Fișiere unice</p>
          <p className="text-3xl font-bold text-gray-800">{uniqueFiles}</p>
        </div>
      </div>

      {/* Statistici playlist per agenție */}
      {Object.keys(byAgency).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cicluri playlist per agenție</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(byAgency).map(([agId, data]) => {
              const agency = agencyMap[agId]
              const items = playlists[agId] || []
              const pd = playlistDuration(items)
              const cycles = pd > 0 ? Math.floor(data.total / pd) : null
              const remainder = pd > 0 ? data.total % pd : 0
              const expectedCycles = (pd > 0 && periodSeconds) ? Math.floor(periodSeconds / pd) : null
              const uptime = expectedCycles ? Math.min(100, Math.round((cycles / expectedCycles) * 100)) : null

              return (
                <div key={agId} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-gray-800">{agency?.name ?? `Agenție #${agId}`}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{agency?.city}</p>
                    </div>
                    {pd > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">
                        playlist {fmtDurationLong(pd)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{cycles ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">cicluri complete</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-700">{fmtDurationLong(data.total)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">timp rulat</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-700">{data.plays}</p>
                      <p className="text-xs text-gray-400 mt-0.5">redări fișiere</p>
                    </div>
                  </div>

                  {remainder > 0 && (
                    <p className="text-xs text-gray-400 mb-3">
                      + {fmtDurationLong(remainder)} din ciclul curent (nefinalizat)
                    </p>
                  )}

                  {uptime !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Uptime față de așteptat ({expectedCycles} cicluri)</span>
                        <span className={`text-xs font-semibold ${uptime >= 90 ? 'text-green-600' : uptime >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {uptime}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${uptime >= 90 ? 'bg-green-500' : uptime >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${uptime}%` }} />
                      </div>
                    </div>
                  )}

                  {pd === 0 && (
                    <p className="text-xs text-amber-600">Playlist gol — nu se poate calcula cicluri</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grafic per fișier */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Timp de rulare per fișier</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            {fileStats.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nicio înregistrare</p>}
            {fileStats.map(f => (
              <div key={f.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0
                      ${f.type === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {f.type === 'video' ? '▶' : '🖼'}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-gray-400">{f.plays}×</span>
                    <span className="text-sm font-semibold text-gray-700 tabular-nums w-16 text-right">{fmtDurationLong(f.total)}</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${f.type === 'video' ? 'bg-purple-400' : 'bg-blue-400'}`}
                    style={{ width: `${Math.round((f.total / maxTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Per agenție</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(byAgency).length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nicio înregistrare</p>}
            {Object.entries(byAgency).sort((a, b) => b[1].total - a[1].total).map(([id, data]) => (
              <div key={id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{agencyMap[id]?.name ?? `#${id}`}</p>
                  <p className="text-xs text-gray-400">{data.plays} redări</p>
                </div>
                <span className="text-sm font-bold text-blue-600 tabular-nums">{fmtDurationLong(data.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel detaliat */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{loading ? 'Se încarcă...' : `${logs.length} înregistrări detaliate`}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
              <tr>
                {['Data / Ora', 'Agenție', 'TV', 'Fișier', 'Tip', 'Durată'].map(h => (
                  <th key={h} className="text-left px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                  Nicio înregistrare. Playerul raportează automat după ce fiecare fișier se termină.
                </td></tr>
              )}
              {logs.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50/60">
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmt(r.played_at)}</td>
                  <td className="px-5 py-3 text-gray-600">{agencyMap[r.agency_id]?.name ?? `#${r.agency_id}`}</td>
                  <td className="px-5 py-3 font-medium text-gray-700">{r.tv_label}</td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate" title={r.original_name}>{r.original_name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                      ${r.media_type === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {r.media_type === 'video' ? '▶ video' : '🖼 imagine'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 tabular-nums">{fmtDuration(r.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
