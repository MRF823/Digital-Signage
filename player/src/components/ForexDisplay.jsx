const CURRENCY_META = {
  EUR: { name: 'Euro', flag: '🇪🇺' },
  USD: { name: 'Dolar SUA', flag: '🇺🇸' },
  GBP: { name: 'Liră sterlină', flag: '🇬🇧' },
  CAD: { name: 'Dolar canadian', flag: '🇨🇦' },
  CHF: { name: 'Franc elvețian', flag: '🇨🇭' },
  DKK: { name: 'Coroană daneză', flag: '🇩🇰' },
  HUF: { name: 'Forint maghiar', flag: '🇭🇺' },
  PLN: { name: 'Zlot polonez', flag: '🇵🇱' },
  SEK: { name: 'Coroană suedeză', flag: '🇸🇪' },
}

const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

function formatUpdated(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} ▪ ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const ORDER = ['EUR', 'USD', 'GBP', 'CAD', 'CHF', 'DKK', 'HUF', 'PLN', 'SEK']
const MAIN = ['EUR', 'USD']

export default function ForexDisplay({ rates, updatedAt }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1a2e20',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '22px 24px 16px',
        textAlign: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, letterSpacing: 3 }}>CEC BANK</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 2.5, marginTop: 4 }}>
          CURSURI DE SCHIMB VALUTAR
        </div>
      </div>

      {/* Antet tabel */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 130px 130px',
        padding: '8px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        {['VALUTĂ', 'CUMPĂRĂM', 'VINDEM'].map((h, i) => (
          <span key={h} style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 10,
            fontWeight: 700, letterSpacing: 1.5,
            textAlign: i === 0 ? 'left' : 'center',
          }}>{h}</span>
        ))}
      </div>

      {/* Rânduri valute */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {ORDER.map(code => {
          const meta = CURRENCY_META[code]
          const r = rates?.[code]
          const isMain = MAIN.includes(code)
          return (
            <div key={code} style={{
              display: 'grid', gridTemplateColumns: '1fr 130px 130px',
              padding: isMain ? '8px 24px' : '6px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: isMain ? 22 : 18, lineHeight: 1 }}>{meta.flag}</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: isMain ? 18 : 13 }}>{meta.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, letterSpacing: 0.5 }}>{code}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, color: '#2ecc71', fontSize: isMain ? 19 : 14 }}>
                {r?.buy != null ? r.buy.toFixed(4) : '—'}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, color: '#e67e22', fontSize: isMain ? 19 : 14 }}>
                {r?.sell != null ? r.sell.toFixed(4) : '—'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 24px 10px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginBottom: 6 }}>
          {updatedAt ? `Ultima actualizare: ${formatUpdated(updatedAt)}` : ''}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, lineHeight: 1.6, textAlign: 'left' }}>
          Cursurile CEC Bank se pot modifica de mai multe ori pe parcursul unei zile, în funcție de mișcările pieței valutare interbancare.<br />
          În cazul schimburilor valutare inițiate online, de persoane fizice, se aplică cursul valutar mai avantajos, valabil pe Internet și Mobile Banking.
        </div>
      </div>
    </div>
  )
}
