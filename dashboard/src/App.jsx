import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Content from './pages/Content'
import Agencies from './pages/Agencies'
import TVs from './pages/TVs'
import Groups from './pages/Groups'

function Layout({ children }) {
  const navigate = useNavigate()
  const logout = () => { localStorage.removeItem('token'); navigate('/login') }
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-900 text-white px-6 py-3 flex items-center gap-8">
        <span className="font-bold text-blue-300 text-lg">BancaSign</span>
        {[['/', 'Conținut'], ['/agencies', 'Agenții'], ['/tvs', 'TV-uri'], ['/groups', 'Grupuri']].map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => isActive ? 'text-white border-b-2 border-blue-400 pb-1' : 'text-blue-200 hover:text-white'}>
            {label}
          </NavLink>
        ))}
        <button onClick={logout} className="ml-auto text-blue-300 hover:text-white text-sm">Ieșire</button>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}

function AuthGuard({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout><Content /></Layout></AuthGuard>} />
        <Route path="/agencies" element={<AuthGuard><Layout><Agencies /></Layout></AuthGuard>} />
        <Route path="/tvs" element={<AuthGuard><Layout><TVs /></Layout></AuthGuard>} />
        <Route path="/groups" element={<AuthGuard><Layout><Groups /></Layout></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
