import { useState, useEffect } from 'react'
import { getSettings, updateSettings, testDailyReport } from '../api'

export default function Settings() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Raport zilnic
  const [reportEnabled, setReportEnabled] = useState(false)
  const [reportEmails, setReportEmails] = useState(['', '', ''])
  const [reportSaving, setReportSaving] = useState(false)
  const [reportSaved, setReportSaved] = useState(false)
  const [reportError, setReportError] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    getSettings().then(data => {
      setEmail(data.alert_email || '')
      setReportEnabled(data.daily_report_enabled === '1')
      try {
        const emails = JSON.parse(data.daily_report_emails || '[]')
        const padded = [...emails, '', '', ''].slice(0, 3)
        setReportEmails(padded)
      } catch { setReportEmails(['', '', '']) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateSettings({ alert_email: email })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Eroare la salvare.') }
    finally { setSaving(false) }
  }

  const handleReportSave = async (e) => {
    e.preventDefault()
    setReportSaving(true); setReportError(''); setReportSaved(false)
    try {
      const validEmails = reportEmails.filter(e => e && e.includes('@'))
      await updateSettings({
        daily_report_enabled: reportEnabled ? '1' : '0',
        daily_report_emails: JSON.stringify(validEmails),
      })
      setReportSaved(true)
      setTimeout(() => setReportSaved(false), 3000)
    } catch { setReportError('Eroare la salvare.') }
    finally { setReportSaving(false) }
  }

  const inputStyle = {
    width: '100%', height: 36, padding: '0 12px', border: '1px solid var(--border)',
    borderRadius: 8, background: 'var(--surface)', color: 'var(--fg)', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--fg)', margin: 0 }}>
          Setări
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 3 }}>Configurare notificări și preferințe sistem</p>
      </div>

      {/* Card notificări offline */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', maxWidth: 520 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14.5, color: 'var(--fg)', margin: 0 }}>
            Notificări offline TV
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3 }}>
            Trimite email când un TV rămâne offline mai mult de 10 minute.
          </p>
        </div>
        {loading ? (
          <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--fg-3)' }}>Se încarcă...</div>
        ) : (
          <form onSubmit={handleSave} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}>
                Adresă email alertă
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@bancaexemplu.ro"
                style={inputStyle}
              />
              <p style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 5 }}>
                Lasă gol dacă nu vrei notificări prin email.
              </p>
            </div>
            {error && <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={saving}
                style={{ height: 36, padding: '0 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
              {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Salvat!</span>}
            </div>
          </form>
        )}
      </div>

      {/* Card raport zilnic */}
      <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', maxWidth: 520 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14.5, color: 'var(--fg)', margin: 0 }}>
            Raport zilnic
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3 }}>
            Trimite un rezumat automat în fiecare zi la 07:00 — stare TV-uri, activitate utilizatori, observații.
          </p>
        </div>
        {loading ? (
          <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--fg-3)' }}>Se încarcă...</div>
        ) : (
          <form onSubmit={handleReportSave} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Toggle ON/OFF */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>Activat</p>
                <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>Trimite raport zilnic prin email</p>
              </div>
              <button
                type="button"
                onClick={() => setReportEnabled(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0,
                  background: reportEnabled ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: reportEnabled ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', display: 'block',
                }} />
              </button>
            </div>

            {/* Email-uri destinatare */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: reportEnabled ? 1 : .45, transition: 'opacity .2s' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>
                Adrese email destinatare (maxim 3)
              </label>
              {reportEmails.map((em, i) => (
                <input
                  key={i}
                  type="email"
                  value={em}
                  disabled={!reportEnabled}
                  onChange={e => {
                    const next = [...reportEmails]
                    next[i] = e.target.value
                    setReportEmails(next)
                  }}
                  placeholder={`Email ${i + 1}${i === 0 ? ' (obligatoriu dacă e activat)' : ' (opțional)'}`}
                  style={{ ...inputStyle, opacity: reportEnabled ? 1 : .6 }}
                />
              ))}
              <p style={{ fontSize: 11.5, color: 'var(--fg-3)', margin: 0 }}>
                Raportul este generat automat de AI și trimis în fiecare dimineață.
              </p>
            </div>

            {reportError && <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{reportError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" disabled={reportSaving}
                style={{ height: 36, padding: '0 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: reportSaving ? .6 : 1 }}>
                {reportSaving ? 'Se salvează...' : 'Salvează'}
              </button>
              {reportSaved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Salvat!</span>}
              <button
                type="button"
                disabled={testSending}
                onClick={async () => {
                  setTestSending(true); setTestResult('')
                  try {
                    await testDailyReport()
                    setTestResult('ok')
                  } catch {
                    setTestResult('err')
                  } finally {
                    setTestSending(false)
                    setTimeout(() => setTestResult(''), 5000)
                  }
                }}
                style={{ height: 36, padding: '0 16px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: testSending ? 'not-allowed' : 'pointer', opacity: testSending ? .6 : 1 }}>
                {testSending ? 'Se trimite...' : 'Trimite test acum'}
              </button>
              {testResult === 'ok' && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Email trimis!</span>}
              {testResult === 'err' && <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>✗ Eroare la trimitere</span>}
            </div>
          </form>
        )}
      </div>

      {/* SMTP info */}
      <div style={{ marginTop: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', maxWidth: 520 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 8 }}>Configurare SMTP</p>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8 }}>
          Email-urile se trimit prin variabilele de mediu configurate pe server:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {['SMTP_HOST — serverul de mail', 'SMTP_PORT — portul (implicit 587)', 'SMTP_USER — utilizator autentificare',
            'SMTP_PASS — parola', 'SMTP_FROM — adresa expeditor', 'SMTP_SECURE — true pentru SSL/TLS'].map(line => (
            <code key={line} style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--fg-2)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 4, display: 'block' }}>
              {line}
            </code>
          ))}
        </div>
      </div>
    </div>
  )
}
