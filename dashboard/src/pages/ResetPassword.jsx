import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return setError('Parolele nu coincid')
    if (password.length < 6) return setError('Parola trebuie să aibă minim 6 caractere')
    setError('')
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Link invalid sau expirat')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm text-center">
        <p className="text-red-600 mb-4">Link invalid.</p>
        <Link to="/login" className="text-blue-600 hover:underline text-sm">Înapoi la login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-2 text-center">DisplayIQ</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Setează parolă nouă</p>
        {done ? (
          <p className="text-green-700 bg-green-50 rounded-lg p-3 text-sm text-center">Parolă schimbată! Te redirecționăm...</p>
        ) : (
          <form onSubmit={submit}>
            {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
            <label className="block text-sm font-medium text-gray-700 mb-1">Parolă nouă</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmă parola</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
              {loading ? 'Se salvează...' : 'Salvează parola'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
