import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../api'

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  )
}

function PasswordField({ value, onChange, required, minLength, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange}
        required={required} minLength={minLength} placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

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
            <div className="mb-4">
              <PasswordField value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmă parola</label>
            <div className="mb-6">
              <PasswordField value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
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
