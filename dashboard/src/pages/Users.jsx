import { useState, useEffect } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '../api'

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

function PasswordField({ value, onChange, placeholder, required, minLength }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

const ROLE_LABEL = { admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }
const ROLE_COLOR = {
  admin: 'bg-purple-100 text-purple-700',
  operator: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', role: 'viewer', password: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getUsers().then(setUsers).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openAdd = () => { setForm({ email: '', name: '', role: 'viewer', password: '' }); setConfirmPassword(''); setError(''); setShowAdd(true) }
  const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, role: u.role, password: '' }); setConfirmPassword(''); setError('') }

  const saveNew = async (e) => {
    e.preventDefault()
    if (form.password !== confirmPassword) return setError('Parolele nu coincid')
    setSaving(true); setError('')
    try {
      await createUser(form)
      setShowAdd(false); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare')
    } finally { setSaving(false) }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (form.password && form.password !== confirmPassword) return setError('Parolele nu coincid')
    setSaving(true); setError('')
    try {
      const data = { name: form.name, role: form.role }
      if (form.password) data.password = form.password
      await updateUser(editUser.id, data)
      setEditUser(null); load()
    } catch (err) {
      setError(err.response?.data?.error || 'Eroare')
    } finally { setSaving(false) }
  }

  const toggleActive = async (u) => {
    await updateUser(u.id, { is_active: !u.is_active })
    load()
  }

  const remove = async (u) => {
    if (!confirm(`Ștergi utilizatorul ${u.email}?`)) return
    try { await deleteUser(u.id); load() } catch (err) { alert(err.response?.data?.error || 'Eroare') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Utilizatori</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gestionează accesul la DisplayIQ</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          + Utilizator nou
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-center py-12 text-gray-400 text-sm">Se încarcă...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Nume</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Rol</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{u.name || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(u)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${u.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                      {u.is_active ? 'Activ' : 'Inactiv'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 mr-3 text-xs font-medium">Editează</button>
                    <button onClick={() => remove(u)} className="text-red-500 hover:text-red-700 text-xs font-medium">Șterge</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal title="Utilizator nou" onClose={() => setShowAdd(false)}>
          <form onSubmit={saveNew} className="space-y-4">
            {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parolă</label>
              <PasswordField required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmă parola</label>
              <PasswordField required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">Anulează</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Se salvează...' : 'Adaugă'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Editează — ${editUser.email}`} onClose={() => setEditUser(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nume</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parolă nouă (opțional)</label>
              <PasswordField minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Lasă gol pentru a nu schimba" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmă parola nouă</label>
              <PasswordField value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Lasă gol pentru a nu schimba" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm">Anulează</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
