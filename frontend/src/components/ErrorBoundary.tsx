import React from 'react'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="glass-card p-8 rounded-3xl max-w-lg">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Something went wrong</p>
              <p className="text-sm text-[var(--text)] mt-3">{this.state.error?.message || 'Unknown error'}</p>
              <button
                className="mt-6 px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)]/5 text-[10px] font-black uppercase tracking-[0.2em]"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}


