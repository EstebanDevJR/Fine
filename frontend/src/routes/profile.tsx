import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../api/useAuth'
import { api } from '../api/client'
import { User as UserIcon, LogOut, Trash2 } from 'lucide-react'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/40 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text)]">{value || '—'}</span>
    </div>
  )
}

export function ProfilePage() {
  const { user, session, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/auth' })
    }
  }, [loading, user, navigate])

  if (loading || (!user && loading === false)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide animate-pulse">Loading secure profile…</p>
        </div>
      </div>
    )
  }

  const provider = user?.app_metadata?.provider ?? 'email'
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : null
  const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : null

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-500 font-black mb-2">Trusted Identity</p>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)]">Profile</h1>
          <p className="text-[var(--text-muted)] mt-2">
            Your authenticated session details, straight from Supabase.
          </p>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:border-amber-500/60 hover:bg-amber-500/15"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="glass-card rounded-[2rem] p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] font-black">User</p>
              <p className="text-lg font-semibold text-[var(--text)]">{user?.email || 'Unknown user'}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <InfoRow label="User ID" value={user?.id} />
            <InfoRow label="Provider" value={provider} />
            <InfoRow label="Last sign-in" value={lastSignIn} />
            <InfoRow label="Session expires" value={expiresAt} />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="glass-card rounded-[1.5rem] border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.16em]">Delete account</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Delete your account, sessions and all your datasets/models/analyses. This action is irreversible.
            </p>
            {deleteError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {deleteError}
              </div>
            )}
            {deleteSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {deleteSuccess}
              </div>
            )}
            <button
              onClick={() => {
                setDeleteError(null)
                setDeleteSuccess(null)
                setConfirmOpen(true)
              }}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </div>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0b0b0f] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="h-5 w-5" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]">Delete account</p>
                <p className="text-sm text-rose-100/80">Permanent action, cannot be undone.</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Your datasets, models, analyses and reports (local and S3) associated with this account will be deleted. Your session will also be closed.
            </p>
            {deleteError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {deleteError}
              </div>
            )}
            {deleteSuccess && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {deleteSuccess}
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteError(null)
                  setDeleteSuccess(null)
                  setDeleting(true)
                  try {
                    await api.deleteAccount()
                    setDeleteSuccess('Account deleted. Signing out...')
                    await signOut()
                    navigate({ to: '/auth' })
                  } catch (err) {
                    setDeleteError((err as Error).message)
                  } finally {
                    setDeleting(false)
                    setConfirmOpen(false)
                  }
                }}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

