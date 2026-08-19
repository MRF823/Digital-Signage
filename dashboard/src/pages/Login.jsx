import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
