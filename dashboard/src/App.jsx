import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { reloadPlayers, syncMedia } from './api'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Content from './pages/Content'
import Agencies from './pages/Agencies'
import TVs from './pages/TVs'
import Groups from './pages/Groups'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import MapPage from './pages/Map'

const IconOverview = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
  </svg>
)
const IconMedia = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="m8 21 4-4 4 4"/><path d="M12 17v4"/>
  </svg>
)
const IconAgencies = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconTVs = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconGroups = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const IconCampaigns = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconMap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const IconReports = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const NAV = [
  { to: '/', label: 'Overview', Icon: IconOverview, end: true },
  { to: '/content', label: 'Conținut', Icon: IconMedia },
  { to: '/agencies', label: 'Agenții', Icon: IconAgencies },
  { to: '/tvs', label: 'TV-uri', Icon: IconTVs },
  { to: '/groups', label: 'Grupuri', Icon: IconGroups },
  { to: '/campaigns', label: 'Campanii', Icon: IconCampaigns },
  { to: '/map', label: 'Hartă', Icon: IconMap },
  { to: '/reports', label: 'Rapoarte', Icon: IconReports },
]

function Sidebar() {
  const navigate = useNavigate()
  const logout = () => { localStorage.removeItem('token'); navigate('/login') }
  const [reloading, setReloading] = useState(false)
  const handleReload = async () => {
    setReloading(true)
    try { await reloadPlayers() } finally { setTimeout(() => setReloading(false), 2000) }
  }

  const [syncing, setSyncing] = useState(false)
  const handleSync = async () => {
    setSyncing(true)
    try { await syncMedia() } finally { setTimeout(() => setSyncing(false), 2000) }
  }

  return (
    <aside className="w-60 h-screen sticky top-0 bg-slate-900 flex flex-col shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <span className="text-white font-bold text-base tracking-tight">BancaSign</span>
        </div>
        <p className="text-slate-500 text-xs mt-1 ml-0.5">Digital Signage · CEC Bank</p>
        <span className="mt-1.5 inline-block text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Dashboard · :{window.location.port}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-2">Meniu</p>
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
               ${isActive
                 ? 'bg-blue-600 text-white font-medium'
                 : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
            }>
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700/60 space-y-1">
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {syncing ? 'Se trimite...' : 'Sync media'}
        </button>
        <button onClick={handleReload} disabled={reloading}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {reloading ? 'Se trimite...' : 'Reload playere'}
        </button>
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <IconLogout />
          Deconectare
        </button>
      </div>
    </aside>
  )
}

function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
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
        <Route path="/" element={<AuthGuard><Layout><Overview /></Layout></AuthGuard>} />
        <Route path="/content" element={<AuthGuard><Layout><Content /></Layout></AuthGuard>} />
        <Route path="/agencies" element={<AuthGuard><Layout><Agencies /></Layout></AuthGuard>} />
        <Route path="/tvs" element={<AuthGuard><Layout><TVs /></Layout></AuthGuard>} />
        <Route path="/groups" element={<AuthGuard><Layout><Groups /></Layout></AuthGuard>} />
        <Route path="/campaigns" element={<AuthGuard><Layout><Campaigns /></Layout></AuthGuard>} />
        <Route path="/map" element={<AuthGuard><Layout><MapPage /></Layout></AuthGuard>} />
        <Route path="/reports" element={<AuthGuard><Layout><Reports /></Layout></AuthGuard>} />
      </Routes>
    </BrowserRouter>
  )
}
