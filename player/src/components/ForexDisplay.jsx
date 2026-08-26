const CURRENCY_META = {
  EUR: { name: 'Euro', code: 'EUR' },
  USD: { name: 'Dolar SUA', code: 'USD' },
  CHF: { name: 'Franc elvețian', code: 'CHF' },
  GBP: { name: 'Liră sterlină', code: 'GBP' },
  CAD: { name: 'Dolar canadian', code: 'CAD' },
  DKK: { name: 'Coroană daneză', code: 'DKK' },
  HUF: { name: 'Forint maghiar', code: 'HUF' },
  PLN: { name: 'Zlot polonez', code: 'PLN' },
  SEK: { name: 'Coroană suedeză', code: 'SEK' },
}

const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

function formatUpdated(str) {
  if (!str) return ''
  // format de la CEC: "DD.MM.YYYY HH:MM"
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2})/)
  if (!m) return str
  return `${m[4]} · ${parseInt(m[1])} ${MONTHS[parseInt(m[2]) - 1]} ${m[3]}`
}

const MAIN = ['EUR', 'USD', 'CHF', 'GBP']
const SECONDARY = ['CAD', 'DKK', 'HUF', 'PLN', 'SEK']

export default function ForexDisplay({ rates, updatedAt }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0d1f14',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ color: '#fff', fontSize: 36, fontWeight: 900, letterSpacing: 4 }}>CEC BANK</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 2.5, fontWeight: 600 }}>
            CURSURI DE SCHIMB VALUTAR
          </span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'right' }}>
          {updatedAt ? `Ultima actualizare: ${formatUpdated(updatedAt)}` : ''}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Coloane header */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Column labels */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 200px 200px',
            padding: '10px 48px 6px',
            flexShrink: 0,
          }}>
            {['VALUTĂ', 'CUMPĂRĂM', 'VINDEM'].map((h, i) => (
              <span key={h} style={{
                color: 'rgba(255,255,255,0.35)', fontSize: 11,
                fontWeight: 700, letterSpacing: 2,
                textAlign: i === 0 ? 'left' : 'center',
              }}>{h}</span>
            ))}
          </div>

          {/* Valute principale */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0, padding: '0 0 8px' }}>
            {MAIN.map((code, idx) => {
              const meta = CURRENCY_META[code]
              const r = rates?.[code]
              const hasBuy = r?.buy != null
              const hasSell = r?.sell != null
              const isFirst = idx === 0
              return (
                <div key={code} style={{
                  display: 'grid', gridTemplateColumns: '1fr 200px 200px',
                  padding: '14px 48px',
                  borderBottom: idx < MAIN.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  alignItems: 'center',
                  background: isFirst ? 'rgba(255,255,255,0.025)' : 'transparent',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>{meta.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 1, marginTop: 2 }}>{code}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 800, color: hasBuy ? '#2ecc71' : 'rgba(255,255,255,0.2)', fontSize: 26 }}>
                    {hasBuy ? r.buy.toFixed(4) : '—'}
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 800, color: hasSell ? '#e67e22' : 'rgba(255,255,255,0.2)', fontSize: 26 }}>
                    {hasSell ? r.sell.toFixed(4) : '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Valute secundare */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '6px 0',
            flexShrink: 0,
          }}>
            {SECONDARY.map((code, idx) => {
              const meta = CURRENCY_META[code]
              const r = rates?.[code]
              const hasBuy = r?.buy != null
              const hasSell = r?.sell != null
              return (
                <div key={code} style={{
                  display: 'grid', gridTemplateColumns: '1fr 200px 200px',
                  padding: '7px 48px',
                  borderBottom: idx < SECONDARY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 14 }}>{meta.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, letterSpacing: 0.5 }}>{code}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 700, color: hasBuy ? 'rgba(46,204,113,0.7)' : 'rgba(255,255,255,0.15)', fontSize: 16 }}>
                    {hasBuy ? r.buy.toFixed(4) : '—'}
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 700, color: hasSell ? 'rgba(230,126,34,0.7)' : 'rgba(255,255,255,0.15)', fontSize: 16 }}>
                    {hasSell ? r.sell.toFixed(4) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div style={{
        padding: '8px 48px 12px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 15, lineHeight: 1.6 }}>
          <div>Cursurile CEC Bank se pot modifica de mai multe ori pe parcursul unei zile, în funcție de mișcările pieței valutare interbancare.</div>
          <div>În cazul schimburilor valutare inițiate online, de persoane fizice, se aplică cursul valutar mai avantajos, valabil pe Internet și Mobile Banking.</div>
        </div>
      </div>
    </div>
  )
}
