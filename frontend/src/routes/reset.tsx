import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../api/supabaseClient'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>('Verifying recovery link...')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Supabase emite PASSWORD_RECOVERY cuando se abre el enlace
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setMessage('Valid link. Set your new password.')
      }
    })
    // In case we already have a session from the link
    supabase.auth.getSession().then(({ data: sess }) => {
      if (sess.session) {
        setReady(true)
        setMessage('Valid link. Set your new password.')
      }
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const submit = async () => {
    setError(null)
    setMessage(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) {
      setError(err.message)
    } else {
      setMessage('Password updated. Redirecting...')
      setTimeout(() => navigate({ to: '/upload' }), 1000)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050505] text-white px-6">
      <div className="w-full max-w-md space-y-6">
        <button
          onClick={() => navigate({ to: '/' })}
          className="flex items-center gap-2 text-white/60 text-sm hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Reset password</h1>
              <p className="text-sm text-white/60">Use the link sent to your email.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-white/70">New password</label>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <KeyRound className="w-4 h-4 text-white/50" />
              <input
                type="password"
                className="bg-transparent w-full outline-none text-white placeholder:text-white/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={!ready}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-white/70">Confirm password</label>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <KeyRound className="w-4 h-4 text-white/50" />
              <input
                type="password"
                className="bg-transparent w-full outline-none text-white placeholder:text-white/30"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                disabled={!ready}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300 flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{message}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!ready || busy}
            className="w-full rounded-2xl bg-white text-black font-bold py-3 text-sm hover:bg-blue-50 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
          </button>
        </div>
      </div>
    </main>
  )
}

