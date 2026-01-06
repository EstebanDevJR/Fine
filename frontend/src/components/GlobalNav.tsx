import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { MagneticButton } from '../landing/MagneticButton'
import { Logo } from './Logo'
import { useTheme } from './useTheme'
import { Moon, Sun, RefreshCw, AlertCircle, Menu, X } from 'lucide-react'
import { useAuth } from '../api/useAuth'

export function GlobalNav() {
  const router = useRouterState()
  const { theme, toggleTheme } = useTheme()
  const { user, loading, refreshing, authError, refreshSession } = useAuth()
  const isLanding = router.location.pathname === '/'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    <>
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-6 transition-all duration-300 md:px-12 backdrop-blur-2xl bg-[var(--card-bg)]/80 border-b border-[var(--card-border)] shadow-lg">
        <Link to="/" className="transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2 rounded-lg">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`group relative font-sans text-sm font-medium transition-all duration-200 ${
                router.location.pathname === link.to 
                  ? 'text-[var(--text)] font-semibold' 
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-emerald-500 transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-emerald-500/30" />
                  )}
                </>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:flex items-center gap-2 text-[10px]">
            <div className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              loading || refreshing
                ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
            }`}>
              {loading ? 'Securing session' : refreshing ? 'Refreshing' : 'Session ok'}
            </div>
            <button
              onClick={() => refreshSession()}
              className="p-2.5 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)]/5 text-[var(--text)] transition-all hover:scale-105 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Refresh session"
              aria-label="Refresh session"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {authError && (
              <div className="flex items-center gap-1.5 text-rose-500 text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle size={14} />
                <span>{authError}</span>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text)] transition-all hover:bg-[var(--card-border)] hover:scale-105 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <MagneticButton
            variant="secondary"
            size="default"
            onClick={() => window.open('https://github.com/EstebanDevJR/Fine.git', '_blank', 'noopener,noreferrer')}
            className="hidden sm:flex"
          >
            GitHub
          </MagneticButton>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text)] transition-all hover:bg-[var(--card-border)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-20 right-0 left-0 z-40 md:hidden bg-[var(--card-bg)] border-b border-[var(--card-border)] shadow-xl backdrop-blur-2xl animate-fade-in">
            <div className="px-6 py-4 space-y-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl font-medium transition-all ${
                    router.location.pathname === link.to
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'text-[var(--text)] hover:bg-[var(--card-bg)] hover:border hover:border-[var(--card-border)]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-[var(--card-border)] space-y-2">
                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] ${
                  loading || refreshing
                    ? 'border border-amber-500/40 text-amber-500 bg-amber-500/10'
                    : 'border border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                }`}>
                  {loading ? 'Securing session' : refreshing ? 'Refreshing' : 'Session ok'}
                </div>
                {authError && (
                  <div className="flex items-center gap-2 text-rose-500 text-xs px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <AlertCircle size={16} />
                    <span>{authError}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    refreshSession()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--card-border)] text-[var(--text)] hover:bg-[var(--text)]/5 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Refresh Session
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
