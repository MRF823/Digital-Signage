import { useState, useEffect } from 'react'
import { getSettings, updateSettings } from '../api'

export default function Settings() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings()
      .then(data => { setEmail(data.alert_email || ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateSettings({ alert_email: email })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Eroare la salvare.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Setări</h1>
        <p className="text-slate-500 mt-1">Configurare notificări și preferințe sistem</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Notificări offline TV</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Trimite email când un TV rămâne offline mai mult de 2 minute.
          </p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-slate-400 text-sm">Se încarcă...</div>
        ) : (
          <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Adresă email alertă
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ex: admin@bancaexemplu.ro"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1">
                Lasă gol dacă nu vrei notificări prin email.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">Salvat!</span>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 max-w-lg">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Configurare SMTP</h3>
        <p className="text-xs text-slate-500">
          Email-urile se trimit prin variabilele de mediu configurate pe server:
        </p>
        <ul className="mt-2 space-y-0.5 text-xs font-mono text-slate-600">
          <li>SMTP_HOST — serverul de mail</li>
          <li>SMTP_PORT — portul (implicit 587)</li>
          <li>SMTP_USER — utilizator autentificare</li>
          <li>SMTP_PASS — parola</li>
          <li>SMTP_FROM — adresa expeditor</li>
          <li>SMTP_SECURE — true pentru SSL/TLS</li>
        </ul>
      </div>
    </div>
  )
}
