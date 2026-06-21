import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await login(username, password)
      localStorage.setItem('token', token)
      navigate('/')
    } catch {
      setError('Utilizator sau parolă incorectă.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">BancaSign</h1>
        {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <label className="block text-sm font-medium text-gray-700 mb-1">Utilizator</label>
        <input value={username} onChange={e => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
          {loading ? 'Se conectează...' : 'Intră în cont'}
        </button>
      </form>
    </div>
  )
}
