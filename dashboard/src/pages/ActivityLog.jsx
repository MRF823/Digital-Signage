import { useEffect, useState } from 'react'
import { getActivityLog } from '../api'

function formatDate(str) {
  if (!str) return '—'
  const d = new Date(str + 'Z')
  return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function parseDetails(str) {
  if (!str) return null
  try { return JSON.parse(str) } catch { return null }
}

function DetailsCell({ raw }) {
  const d = parseDetails(raw)
  if (!d) return null
  return (
    <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
      {Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' · ')}
    </span>
  )
}

const ACTION_COLORS = {
  'Login': 'var(--accent)',
  'Forex activat': '#10B981',
  'Forex dezactivat': 'var(--fg-3)',
  'Info Obligatorii activat': '#10B981',
  'Info Obligatorii dezactivat': 'var(--fg-3)',
  'Push reload playere': '#F59E0B',
  'Sincronizare media': '#F59E0B',
}

export default function ActivityLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    getActivityLog(500).then(setRows).finally(() => setLoading(false))
  }, [])

  const filtered = filter
    ? rows.filter(r =>
        r.user_email.toLowerCase().includes(filter.toLowerCase()) ||
        r.action.toLowerCase().includes(filter.toLowerCase())
      )
    : rows

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--fg)' }}>Jurnal activitate</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-3)' }}>Ultimele {rows.length} acțiuni înregistrate în dashboard</p>
        </div>
        <input
          type="text"
          placeholder="Caută utilizator sau acțiune..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          style={{ background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p style={{ color: 'var(--fg-3)' }}>Se încarcă...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <p style={{ color: 'var(--fg-3)' }}>{filter ? 'Niciun rezultat.' : 'Nicio activitate înregistrată încă.'}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* Header */}
          <div className="grid text-xs font-semibold uppercase tracking-wide px-4 py-2.5"
            style={{ gridTemplateColumns: '180px 1fr 1fr 1fr', background: 'var(--surface-2)', color: 'var(--fg-3)', borderBottom: '1px solid var(--border)' }}>
            <span>Data și ora</span>
            <span>Utilizator</span>
            <span>Acțiune</span>
            <span>Detalii</span>
          </div>

          {filtered.map((row, i) => (
            <div key={row.id}
              className="grid items-center px-4 py-3 text-sm"
              style={{
                gridTemplateColumns: '180px 1fr 1fr 1fr',
                background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
              <span className="font-mono text-xs" style={{ color: 'var(--fg-3)' }}>{formatDate(row.created_at)}</span>
              <span className="font-medium truncate pr-2" style={{ color: 'var(--fg)' }}>{row.user_email}</span>
              <span className="font-medium" style={{ color: ACTION_COLORS[row.action] || 'var(--fg-2)' }}>{row.action}</span>
              <DetailsCell raw={row.details} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
