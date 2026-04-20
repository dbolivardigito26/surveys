import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  )
}

export default function Layout() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const name = (() => {
    try { return JSON.parse(atob(localStorage.getItem('token')!.split('.')[1])).name } catch { return 'Usuario' }
  })()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F8F5FF] dark:bg-[#0A0A19] flex flex-col">
      {/* ── Top nav ── */}
      <header className="bg-[#0A0A19] dark:bg-[#0A0A19] border-b border-white/5 shadow-lg">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-6">

          {/* Logo — versión blanca sobre fondo oscuro */}
          <NavLink to="/" className="flex items-center shrink-0">
            <img
              src="/Strategio_Logo Oficial_ver2_2.png"
              alt="Strategio"
              className="h-24 w-auto"
            />
          </NavLink>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1 ml-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-lg transition font-medium ${
                  isActive
                    ? 'bg-[#4D0FC1] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              Encuestas
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-lg transition font-medium ${
                  isActive
                    ? 'bg-[#4D0FC1] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              Usuarios
            </NavLink>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/8 transition"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* User */}
            <div className="flex items-center gap-1.5 text-sm text-white/60 pl-1">
              <div className="w-7 h-7 rounded-full bg-[#4D0FC1] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block max-w-[120px] truncate">{name}</span>
              <ChevronDownIcon />
            </div>

            <button
              onClick={logout}
              className="text-sm text-white/50 hover:text-white transition px-2 py-1 rounded-lg hover:bg-white/8"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
