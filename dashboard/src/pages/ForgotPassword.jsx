import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-2 text-center">DisplayIQ</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Resetare parolă</p>
        {sent ? (
          <div className="text-center">
            <p className="text-green-700 bg-green-50 rounded-lg p-3 text-sm mb-4">
              Dacă emailul există în sistem, vei primi un link de resetare în câteva minute.
            </p>
            <Link to="/login" className="text-blue-600 hover:underline text-sm">Înapoi la login</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
              {loading ? 'Se trimite...' : 'Trimite link reset'}
            </button>
            <p className="text-center mt-4 text-sm">
              <Link to="/login" className="text-blue-600 hover:underline">Înapoi la login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
