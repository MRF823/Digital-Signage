import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { reloadPlayers, syncMedia, getTokenPayload } from './api'
import { useInactivityLogout } from './useInactivityLogout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Users from './pages/Users'
import Overview from './pages/Overview'
import Content from './pages/Content'
import Agencies from './pages/Agencies'
import TVs from './pages/TVs'
import Groups from './pages/Groups'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import MapPage from './pages/Map'
import ForexTVs from './pages/ForexTVs'
import InfoObligatorii from './pages/InfoObligatorii'
import Settings from './pages/Settings'
import AI from './pages/AI'

const IconOverview = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
  </svg>
)
const IconMedia = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="m8 21 4-4 4 4"/><path d="M12 17v4"/>
  </svg>
)
const IconAgencies = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const IconTVs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)
const IconGroups = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
)
const IconCampaigns = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const IconReports = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconForex = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IconInfo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
)
const IconAI = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V11h1a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1v-1a2 2 0 0 1 2-2h1V9.5C8.8 8.8 8 7.5 8 6a4 4 0 0 1 4-4z"/>
  </svg>
)
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const ROLE_LABEL = { admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }
const ROLE_BADGE = {
  admin: 'bg-purple-500/20 text-purple-300',
  operator: 'bg-blue-500/20 text-blue-300',
  viewer: 'bg-slate-500/20 text-slate-400',
}

// Flat NAV kept for RoleGuard + route mapping
const NAV = [
  { to: '/', label: 'Overview', Icon: IconOverview, end: true, roles: ['admin','operator','viewer'] },
  { to: '/content', label: 'Librărie Media', Icon: IconMedia, roles: ['admin','operator'] },
  { to: '/campaigns', label: 'Campanii', Icon: IconCampaigns, roles: ['admin','operator'] },
  { to: '/groups', label: 'Grupuri TV Vitrina', Icon: IconGroups, roles: ['admin','operator'] },
  { to: '/agencies', label: 'Agenții', Icon: IconAgencies, roles: ['admin','operator'] },
  { to: '/tvs', label: 'TV-uri', Icon: IconTVs, roles: ['admin','operator'] },
  { to: '/map', label: 'Hartă', Icon: IconMap, roles: ['admin','operator'] },
  { to: '/reports', label: 'Rapoarte', Icon: IconReports, roles: ['admin','operator','viewer'] },
  { to: '/forex', label: 'Schimb Valutar', Icon: IconForex, roles: ['admin','operator'] },
  { to: '/info', label: 'Info Obligatorii', Icon: IconInfo, roles: ['admin','operator'] },
  { to: '/ai', label: 'Asistent AI', Icon: IconAI, roles: ['admin','operator','viewer'] },
  { to: '/settings', label: 'Setări', Icon: IconSettings, roles: ['admin'] },
]

// V4 sidebar sections
const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: ['/', '/tvs', '/agencies'],
  },
  {
    label: 'Conținut',
    items: ['/content', '/campaigns', '/groups'],
  },
  {
    label: 'Analiță',
    items: ['/reports', '/map', '/ai'],
  },
  {
    label: 'Special',
    items: ['/forex', '/info'],
  },
  {
    label: 'Admin',
    items: ['/settings'],
  },
]

function Sidebar({ dark, onToggleTheme }) {
  const navigate = useNavigate()
  const logout = () => { localStorage.removeItem('token'); navigate('/login') }
  const role = getTokenPayload()?.role || 'viewer'
  const [reloading, setReloading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleReload = async () => {
    setReloading(true)
    try { await reloadPlayers() } finally { setTimeout(() => setReloading(false), 2000) }
  }
  const handleSync = async () => {
    setSyncing(true)
    try { await syncMedia() } finally { setTimeout(() => setSyncing(false), 2000) }
  }

  const navByTo = Object.fromEntries(NAV.map(n => [n.to, n]))

  return (
    <aside className="w-60 h-screen sticky top-0 flex flex-col shrink-0 overflow-hidden" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/[.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(37,99,235,.4)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4" stroke="white" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-extrabold text-[15px] tracking-tight leading-none">DisplayIQ</div>
            <div className="text-white/30 text-[10px] tracking-[.6px] uppercase mt-0.5">Digital Signage</div>
          </div>
        </div>

        {/* User row */}
        <div className="mt-3 pt-3 border-t border-white/[.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white text-[11px] font-bold">
            {(getTokenPayload()?.email || getTokenPayload()?.name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/75 text-xs font-medium truncate">{getTokenPayload()?.email || getTokenPayload()?.name || 'Utilizator'}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[role] || ROLE_BADGE.viewer}`}>
              {ROLE_LABEL[role] || role}
            </span>
          </div>
          {/* Dark/light toggle */}
          <button
            onClick={onToggleTheme}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[.06] transition-colors flex-shrink-0"
            title={dark ? 'Mod luminos' : 'Mod întunecat'}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </div>

        {/* Users link for admin */}
        {role === 'admin' && (
          <NavLink to="/users"
            className={({ isActive }) =>
              `mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors
               ${isActive ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/[.06]'}`
            }>
            <IconUsers />
            Utilizatori
          </NavLink>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-3">
        {NAV_SECTIONS.map(section => {
          const items = section.items
            .map(to => navByTo[to])
            .filter(n => n && n.roles.includes(role))
          if (items.length === 0) return null
          return (
            <div key={section.label}>
              <p className="text-white/25 text-[9.5px] font-bold uppercase tracking-[.8px] px-3 mb-1">{section.label}</p>
              <div className="space-y-0.5">
                {items.map(({ to, label, Icon, end }) => (
                  <NavLink key={to} to={to} end={end}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-colors
                       ${isActive
                         ? 'bg-blue-600 text-white font-semibold'
                         : 'text-white/45 hover:text-white/85 hover:bg-white/[.06]'}`
                    }>
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white/50" />
                        )}
                        <Icon />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/[.07] space-y-0.5">
        <div className="text-white/20 text-[10px] font-mono px-3 mb-1.5">:{window.location.port}</div>
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[.06] transition-colors disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {syncing ? 'Se trimite...' : 'Sync media'}
        </button>
        <button onClick={handleReload} disabled={reloading}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[.06] transition-colors disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {reloading ? 'Se trimite...' : 'Reload playere'}
        </button>
        <button onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[.06] transition-colors">
          <IconLogout />
          Deconectare
        </button>
      </div>
    </aside>
  )
}

function Layout({ children, dark, onToggleTheme }) {
  useInactivityLogout()

  return (
    <div className="flex min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar dark={dark} onToggleTheme={onToggleTheme} />
      <main className="flex-1 overflow-auto min-w-0 flex flex-col">
        <div className="flex-1 max-w-6xl mx-auto w-full p-6 lg:p-8">
          {children}
        </div>
        <footer className="border-t px-8 py-3 flex items-center justify-between text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--fg-3)' }}>
          <span>Copyright © 2026 <a href="https://funkymedia.ro" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-semibold">FunkyMedia.ro</a>. All rights reserved.</span>
          <span style={{ color: 'var(--fg-2)' }}>Digital Signage Platform <strong>v1.0</strong></span>
        </footer>
      </main>
    </div>
  )
}

const ROUTE_ROLES = Object.fromEntries(NAV.map(({ to, roles }) => [to, roles]))

function RoleGuard({ path, children }) {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />
  const role = getTokenPayload()?.role || 'viewer'
  const allowed = ROUTE_ROLES[path] ?? ['admin']
  if (!allowed.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
  }

  const wrap = (path, Page) => (
    <RoleGuard path={path}>
      <Layout dark={dark} onToggleTheme={toggleTheme}>
        <Page />
      </Layout>
    </RoleGuard>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={wrap('/', Overview)} />
        <Route path="/content" element={wrap('/content', Content)} />
        <Route path="/agencies" element={wrap('/agencies', Agencies)} />
        <Route path="/tvs" element={wrap('/tvs', TVs)} />
        <Route path="/groups" element={wrap('/groups', Groups)} />
        <Route path="/campaigns" element={wrap('/campaigns', Campaigns)} />
        <Route path="/map" element={wrap('/map', MapPage)} />
        <Route path="/reports" element={wrap('/reports', Reports)} />
        <Route path="/forex" element={wrap('/forex', ForexTVs)} />
        <Route path="/info" element={wrap('/info', InfoObligatorii)} />
        <Route path="/ai" element={wrap('/ai', AI)} />
        <Route path="/users" element={wrap('/users', Users)} />
        <Route path="/settings" element={wrap('/settings', Settings)} />
      </Routes>
    </BrowserRouter>
  )
}
