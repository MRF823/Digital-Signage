import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api'

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await login(email, password)
      localStorage.setItem('token', token)
      navigate('/')
    } catch {
      setError('Email sau parolă incorectă.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">DisplayIQ</h1>
        {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
        <div className="relative mb-6">
          <input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" onClick={() => setShowPass(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <EyeIcon open={showPass} />
          </button>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
          {loading ? 'Se conectează...' : 'Intră în cont'}
        </button>
        <p className="text-center mt-4 text-sm text-gray-500">
          <Link to="/forgot-password" className="text-blue-600 hover:underline">Ai uitat parola?</Link>
        </p>
      </form>
    </div>
  )
}
