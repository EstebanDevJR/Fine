import { Link, useRouterState } from '@tanstack/react-router'
import { MagneticButton } from '../landing/MagneticButton'
import { Logo } from './Logo'
import { useTheme } from './ThemeContext'
import { Moon, Sun, RefreshCw, AlertCircle } from 'lucide-react'
import { useAuth } from '../api/AuthProvider'

export function GlobalNav() {
  const router = useRouterState()
  const { theme, toggleTheme } = useTheme()
  const { user, loading, refreshing, authError, refreshSession } = useAuth()
  const isLanding = router.location.pathname === '/'

  // Don't show this nav on the landing page, as it has its own specialized nav
  if (isLanding) return null

  const links = [
    ...(user ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    { to: '/upload', label: 'Upload' },
    { to: '/audit', label: 'Audit' },
    ...(user ? [{ to: '/analyses', label: 'Analyses' }] : []),
    { to: '/status', label: 'Status' },
    ...(user ? [{ to: '/profile', label: 'Profile' }] : []),
  ]

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-6 transition-all duration-300 md:px-12">
      <Link to="/" className="transition-transform hover:scale-105">
        <Logo />
      </Link>

      <div className="hidden items-center gap-8 md:flex">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`group relative font-sans text-sm font-medium transition-colors ${
              router.location.pathname === link.to ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {({ isActive }) => (
              <>
                {link.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-[var(--text)] transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </>
            )}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 text-[10px]">
          <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] ${
            loading || refreshing
              ? 'border-amber-500/30 text-amber-500'
              : 'border-emerald-500/30 text-emerald-500'
          }`}>
            {loading ? 'Securing session' : refreshing ? 'Refreshing' : 'Session ok'}
          </div>
          <button
            onClick={() => refreshSession()}
            className="p-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)]/5 text-[var(--text)] transition-colors"
            title="Refresh session"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {authError && (
            <div className="flex items-center gap-1 text-rose-500 text-[10px]">
              <AlertCircle size={14} />
              <span>{authError}</span>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text)] transition-all hover:bg-[var(--card-border)]"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <MagneticButton
          variant="secondary"
          size="default"
          onClick={() => window.open('https://github.com', '_blank', 'noopener,noreferrer')}
        >
          GitHub
        </MagneticButton>
      </div>
    </nav>
  )
}
