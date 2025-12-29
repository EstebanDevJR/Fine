import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Toast = {
  id: string
  title: string
  message?: string
  variant?: 'info' | 'success' | 'error'
}

type ToastContextValue = {
  push: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  // Catch unhandled promise rejections (nice for demo polish)
  useEffect(() => {
    const handler = (ev: PromiseRejectionEvent) => {
      const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason)
      push({ title: 'Unexpected error', message: msg, variant: 'error' })
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [push])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 w-[360px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass-card rounded-2xl border p-4 shadow-2xl ${
              t.variant === 'error'
                ? 'border-rose-500/30 bg-rose-500/5'
                : t.variant === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-[var(--card-border)] bg-[var(--bg)]/40'
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text)]">{t.title}</p>
            {t.message && <p className="text-[11px] text-[var(--text-muted)] mt-1">{t.message}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}


