import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Mail, Lock, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../api/AuthProvider'
import { Logo } from '../components/Logo.tsx'

export function AuthPage() {
  const { signInWithEmail, signUpWithEmail, resetPasswordWithEmail, loading, session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const resetRedirect = useMemo(
    () => import.meta.env.VITE_SUPABASE_REDIRECT || `${window.location.origin}/auth/reset`,
    [],
  )

  if (session && !loading) {
    navigate({ to: '/upload' })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
        navigate({ to: '/upload' })
      } else if (mode === 'register') {
        await signUpWithEmail(email, password)
        setMessage('Registro exitoso. Revisa tu correo y valida tu cuenta para iniciar sesión.')
        setMode('login')
        setPassword('')
      } else if (mode === 'reset') {
        await resetPasswordWithEmail(email, resetRedirect)
        setMessage('Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Left Side: Visual/Branding (Hidden on mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-white/5 bg-[#080808] p-12 lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-1/4 -top-1/4 h-full w-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute -bottom-1/4 -right-1/4 h-full w-full bg-indigo-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        </div>

        <div className="relative z-10">
          <Logo />
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="font-['Space_Grotesk'] text-5xl font-bold leading-tight tracking-tight">
              Audit your models <br />
              <span className="text-blue-400 italic">with precision.</span>
            </h2>
            <p className="max-w-md text-lg text-white/50 leading-relaxed">
              The industry standard for dataset verification and model audit reports. 
              Built for teams who care about data integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              "Automated Dataset Scanning",
              "Comprehensive Audit Reports",
              "Real-time Model Validation"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-white/30">
          © 2025 Fine Audit. All rights reserved.
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Back Button */}
        <button 
          onClick={() => navigate({ to: '/' })}
          className="absolute left-6 top-8 flex items-center gap-2 text-sm font-medium text-white/40 transition hover:text-white sm:left-8 lg:left-12"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver</span>
        </button>

        {/* Mobile Logo */}
        <div className="absolute top-8 lg:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight">
              {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create an account' : 'Reset password'}
            </h1>
            <p className="mt-2 text-white/50">
              {mode === 'login'
                ? 'Enter your details to access your dashboard'
                : mode === 'register'
                  ? 'Get started with the most powerful audit platform'
                  : 'Ingresa tu correo y te enviaremos un enlace de recuperación'}
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 ml-1">Email address</label>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-white/30 group-focus-within:text-blue-400 transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-white/5 border border-white/5 pl-11 pr-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-sm font-medium text-white/70">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset')
                          setError(null)
                          setMessage(null)
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-white/30 group-focus-within:text-blue-400 transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl bg-white/5 border border-white/5 pl-11 pr-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black transition hover:bg-blue-50 disabled:opacity-50"
            >
              {busy ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset email'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-white/40">
            {mode === 'login' && (
              <>
                {"Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                    setMessage(null)
                  }}
                  className="font-semibold text-white hover:text-blue-400 transition"
                >
                  Sign up
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                {"Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                    setMessage(null)
                  }}
                  className="font-semibold text-white hover:text-blue-400 transition"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'reset' && (
              <>
                {"Remembered your password? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                    setMessage(null)
                  }}
                  className="font-semibold text-white hover:text-blue-400 transition"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  )
}
