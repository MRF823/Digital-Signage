const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP']

function formatLastUpdate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  const day = d.getDate().toString().padStart(2, '0')
  const month = d.toLocaleDateString('ro-RO', { month: 'long' })
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1)
  const year = d.getFullYear()
  return `${time} ▪ ${day} ${monthCap} ${year}`
}

export default function Ticker({ rates, updatedAt, cecUpdatedAt, bnrUpdatedAt }) {
  if (!rates) return null

  const lastUpdate = formatLastUpdate(cecUpdatedAt || bnrUpdatedAt || updatedAt)

  const s = {
    wrap: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#fff',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    },
    row: (bg) => ({
      display: 'flex', alignItems: 'center', padding: '7px 20px',
      background: bg,
      borderBottom: bg === '#fff' ? '1px solid rgba(0,0,0,0.06)' : 'none',
    }),
    label: (color) => ({
      fontSize: 11, fontWeight: 600, color, width: 72, flexShrink: 0, letterSpacing: '0.05em',
    }),
    cell: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderLeft: '1px solid rgba(0,0,0,0.06)' },
    cur: { fontSize: 12, fontWeight: 600, color: '#374151', width: 26 },
    tag: { fontSize: 10, color: '#9ca3af' },
    val: (color) => ({ fontSize: 15, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }),
    dash: { fontSize: 15, color: '#d1d5db' },
  }

  return (
    <div style={s.wrap}>
      {/* Rând CEC */}
      <div style={s.row('#fff')}>
        <span style={{ ...s.label('#16a34a'), fontSize: 13 }}>CEC BANK</span>
        {CURRENCIES.map(c => {
          const r = rates[c]
          const hasBuySell = r?.buy != null || r?.sell != null
          return (
            <div key={c} style={s.cell}>
              <span style={s.cur}>{c}</span>
              {hasBuySell ? (
                <>
                  <span style={s.tag}>cmp</span>
                  <span style={s.val('#0F6E56')}>{r.buy?.toFixed(4) ?? '—'}</span>
                  <span style={{ fontSize: 12, color: '#d1d5db' }}>/</span>
                  <span style={s.tag}>vnd</span>
                  <span style={s.val('#993C1D')}>{r.sell?.toFixed(4) ?? '—'}</span>
                </>
              ) : (
                <span style={s.dash}>—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Rând BNR */}
      <div style={s.row('#fafaf9')}>
        <span style={s.label('#854F0B')}>BNR REF.</span>
        {CURRENCIES.map(c => (
          <div key={c} style={s.cell}>
            <span style={s.cur}>{c}</span>
            {rates[c]?.reference != null
              ? <span style={s.val('#854F0B')}>{rates[c].reference.toFixed(4)}</span>
              : <span style={s.dash}>—</span>
            }
          </div>
        ))}
      </div>

      {/* Bara "Ultima actualizare" */}
      {lastUpdate && (
        <div style={{
          background: '#6B1F6B',
          padding: '5px 20px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <span style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            Ultima actualizare: {lastUpdate}
          </span>
        </div>
      )}
    </div>
  )
}
