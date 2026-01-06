import { useEffect, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../api/useAuth'
import {
  Activity,
  BarChart2,
  Cpu,
  Database,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/auth' })
  }, [loading, user, navigate])

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets, enabled: Boolean(user) })
  const models = useQuery({ queryKey: ['models'], queryFn: api.listModels, enabled: Boolean(user) })
  const analyses = useQuery({ queryKey: ['analyses'], queryFn: api.listAnalyses, enabled: Boolean(user) })

  const datasetCount = datasets.data?.length ?? 0
  const modelCount = models.data?.length ?? 0
  const analysisCount = analyses.data?.length ?? 0
  const latestAnalyses = (analyses.data || []).slice(-5).reverse()

  const { successCount, failureCount, successRate, lastRunLabel, weeklyTrend } = useMemo(() => {
    const data = analyses.data || []
    const success = data.filter((a) => a.status === 'SUCCESS').length
    const failure = data.filter((a) => a.status === 'FAILURE').length
    const rate = data.length ? Math.round((success / data.length) * 100) : 0
    const last = data.length ? new Date(data[data.length - 1].created_at || '').toLocaleString() : '—'

    const counts: Record<string, number> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      counts[key] = 0
    }
    data.forEach((a) => {
      const key = (a.created_at || '').slice(0, 10)
      if (counts[key] !== undefined) counts[key] += 1
    })
    const trend = Object.entries(counts).map(([day, value]) => ({ day, value }))

    return { successCount: success, failureCount: failure, successRate: rate, lastRunLabel: last, weeklyTrend: trend }
  }, [analyses.data])

  if (loading || (!user && loading === false)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide animate-pulse">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-2">Dashboard</h1>
          <p className="text-[var(--text-muted)] font-medium">Quick overview of your datasets, models and audits</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Owner scoped
          </div>
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-blue-500">
            <Activity className="h-3.5 w-3.5" />
            Live
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Datasets" value={datasetCount} icon={Database} color="emerald" />
        <StatCard label="Models" value={modelCount} icon={Cpu} color="blue" />
        <StatCard label="Analyses" value={analysisCount} icon={BarChart2} color="amber" />
        <StatCard label="Success rate" value={`${successRate}%`} icon={ShieldCheck} color="cyan" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="glass-card p-6 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4">
            <div>
              <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Latest analyses</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Status and references</p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>

          <div className="divide-y divide-[var(--card-border)] rounded-2xl border border-[var(--card-border)] overflow-hidden bg-[var(--bg)]/30">
            {latestAnalyses.length === 0 ? (
              <div className="empty-state">
                <BarChart2 className="w-12 h-12 text-[var(--muted)] opacity-30 mb-4" />
                <p className="text-sm font-semibold text-[var(--text)] mb-1">No analyses yet</p>
                <p className="text-xs text-[var(--muted)] opacity-75">Start your first audit to see results here</p>
              </div>
            ) : (
              latestAnalyses.map((a) => (
                <div key={a.id} className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[var(--bg)]/60 border border-[var(--card-border)]">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[var(--text)]">Analysis #{a.id}</p>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                      dataset {a.dataset_id} · model {a.model_id}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
                    a.status === 'SUCCESS'
                      ? 'text-emerald-500 border-emerald-500/30'
                      : a.status === 'FAILURE'
                        ? 'text-rose-500 border-rose-500/30'
                        : 'text-amber-500 border-amber-500/30'
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/upload"
              className="px-4 py-3 rounded-xl border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
            >
              Go to uploads
            </Link>
            <Link
              to="/audit"
              className="px-4 py-3 rounded-xl bg-[var(--text)] text-[var(--bg)] text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all"
            >
              Launch audit
            </Link>
            <Link
              to="/analyses"
              className="px-4 py-3 rounded-xl border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
            >
              View analyses
            </Link>
          </div>
        </div>

        <div className="glass-card p-6 rounded-[2rem] space-y-5">
          <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text)]">Asset status</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Summary inventory</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KpiBadge icon={<CheckCircle2 className="w-4 h-4" />} label="Successes" value={successCount} tone="emerald" />
            <KpiBadge icon={<AlertTriangle className="w-4 h-4" />} label="Failures" value={failureCount} tone="rose" />
            <KpiBadge icon={<Activity className="w-4 h-4" />} label="Last run" value={lastRunLabel} tone="amber" />
            <KpiBadge icon={<BarChart2 className="w-4 h-4" />} label="7d trend" value={<SparkBars data={weeklyTrend} />} tone="cyan" />
          </div>

          <MiniList title="Datasets" items={datasets.data || []} empty="No datasets" icon={Database} />
          <MiniList title="Models" items={models.data || []} empty="No models" icon={Cpu} />
        </div>
      </div>
    </div>
  )
}

type StatColor = 'emerald' | 'blue' | 'amber' | 'cyan'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  color: StatColor
}) {
  const colors: Record<StatColor, string> = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30 shadow-glow-emerald',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/30 shadow-glow-blue',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/30 shadow-glow-amber',
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
  }
  return (
    <div className="glass-card p-6 rounded-2xl group cursor-default shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all group-hover:scale-110 group-hover:rotate-3 ${colors[color]}`}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-[0.1em] opacity-85 mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-[var(--text)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

function MiniList({
  title,
  items,
  empty,
  icon: Icon,
}: {
  title: string
  items: Array<{ id: number; name?: string; created_at?: string }>
  empty: string
  icon: LucideIcon
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-[var(--bg)]/60 border border-[var(--card-border)]">
          <Icon className="w-4 h-4 text-amber-500" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text)]">{title}</span>
      </div>
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/40 divide-y divide-[var(--card-border)]">
        {items.length === 0 ? (
          <div className="empty-state py-8">
            <Icon className="w-10 h-10 text-[var(--muted)] opacity-30 mb-3" />
            <p className="text-xs text-[var(--muted)] opacity-75">{empty}</p>
          </div>
        ) : (
          items.slice(-5).reverse().map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-3">
              <div className="text-[10px] font-mono text-[var(--text-muted)]">#{item.id}</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text)] truncate">{item.name || `${title.slice(0,-1)} ${item.id}`}</p>
                {item.created_at && (
                  <p className="text-[10px] text-[var(--text-muted)]">{new Date(item.created_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function KpiBadge({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  tone: 'emerald' | 'rose' | 'amber' | 'cyan'
}) {
  const tones: Record<'emerald' | 'rose' | 'amber' | 'cyan', string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    rose: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400',
  }
  return (
    <div className={`p-4 rounded-2xl border ${tones[tone]} flex items-start gap-3`}>
      <div className="p-2 rounded-xl bg-[var(--bg)]/40 border border-[var(--card-border)]">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-bold text-[var(--text)] leading-tight">{value}</p>
      </div>
    </div>
  )
}

function SparkBars({ data }: { data: { day: string; value: number }[] }) {
  if (!data?.length) return <span className="text-[11px] text-[var(--muted)] opacity-75">—</span>
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-12">
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.value}`}
          className="flex-1 rounded-md bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-300 transition-all duration-200 shadow-sm hover:shadow-md"
          style={{ 
            height: `${Math.max((d.value / max) * 100, 8)}%`,
            minHeight: '8px'
          }}
        />
      ))}
    </div>
  )
}

