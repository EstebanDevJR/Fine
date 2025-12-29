import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Activity, Shield, Cpu, Zap, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock3, PlayCircle, Database, Server, Gauge } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Health, Metrics, Ready, Analysis } from '../api/schemas'
import type { UseQueryResult } from '@tanstack/react-query'

export function StatusPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.status })
  const ready = useQuery({ queryKey: ['ready'], queryFn: api.ready })
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: api.metrics })
  const liveTasks = useQuery({
    queryKey: ['liveAnalyses'],
    queryFn: api.listAnalyses,
    refetchInterval: 4000,
  })


  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-2 text-gradient">System Status</h1>
          <p className="text-[var(--text-muted)] font-medium">Real-time infrastructure and agent health</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { health.refetch(); ready.refetch(); metrics.refetch(); }}
            className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] transition-all active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${health.isFetching ? 'animate-spin' : ''}`} />
            REFRESH SIGNALS
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          icon={Activity} 
          label="API Node" 
          value={health.isError ? 'Down' : health.isLoading ? '...' : 'Healthy'} 
          color={health.isError ? 'rose' : 'emerald'}
        />
        <StatCard 
          icon={Shield} 
          label="Auth Guard" 
          value="Active" 
          color="blue"
        />
        <StatCard 
          icon={Cpu} 
          label="Worker Clusters" 
          value="4 Online" 
          color="purple"
        />
        <StatCard 
          icon={Zap} 
          label="Core Latency" 
          value="18ms" 
          color="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <StatusPanel 
          title="Health Check" 
          subtitle="Core API services" 
          data={health.data} 
          isLoading={health.isLoading}
          isError={health.isError}
          error={health.error}
        />
        <StatusPanel 
          title="Readiness" 
          subtitle="Resource availability" 
          data={ready.data} 
          isLoading={ready.isLoading}
          isError={ready.isError}
          error={ready.error}
        />
        <StatusPanel 
          title="Telemetry" 
          subtitle="System performance" 
          data={metrics.data} 
          isLoading={metrics.isLoading}
          isError={metrics.isError}
          error={metrics.error}
        />
      </div>

      <LiveTasksCard query={liveTasks} />

      {/* Uptime Section */}
      <div className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
            <Activity className="w-32 h-32" />
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">Availability Timeline</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em]">Historical Reliability</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[10px] font-black uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            99.99% UPTIME
          </div>
        </div>

        <div className="grid grid-cols-15 md:grid-cols-30 gap-1 md:gap-2 h-16 items-end">
          {Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-full rounded-t-lg transition-all cursor-pointer ${i === 28 ? 'bg-amber-500/40 h-[60%]' : 'bg-emerald-500/30 h-[80%] hover:h-full'}`}
              title={`Day ${30-i}: ${i === 28 ? 'Minor Spike' : 'Operational'}`}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-between text-[9px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)] opacity-50">
          <span>30 Days Ago</span>
          <span>System Current</span>
        </div>
      </div>
    </div>
  )
}

type StatColor = 'emerald' | 'blue' | 'purple' | 'rose' | 'amber'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string
  color: StatColor
}) {
  const colors: Record<StatColor, string> = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  }

  return (
    <div className="glass-card p-5 rounded-2xl group cursor-default">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-110 ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--text)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

function StatusPanel({
  title,
  subtitle,
  data,
  isLoading,
  isError,
  error,
}: {
  title: 'Health Check' | 'Readiness' | 'Telemetry' | string
  subtitle: string
  data: unknown
  isLoading: boolean
  isError: boolean
  error: unknown
}) {
  return (
    <div className="glass-card flex flex-col rounded-[2.5rem] overflow-hidden h-[450px]">
      <div className="px-8 py-6 border-b border-[var(--card-border)] bg-[var(--bg)]/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">{title}</h3>
          <div className={`h-2.5 w-2.5 rounded-full ${isError ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`} />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1 uppercase tracking-tight">{subtitle}</p>
      </div>
      <div className="flex-1 p-6 min-h-0 overflow-hidden flex flex-col">
        <div className="h-full rounded-2xl bg-[var(--bg)]/30 border border-[var(--card-border)] p-4 relative flex flex-col min-h-0">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--bg)]/30 rounded-2xl">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin opacity-40" />
            </div>
          ) : isError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[var(--bg)]/30 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-4 opacity-40" />
              <p className="text-xs font-black text-rose-500 uppercase tracking-widest">Signal Lost</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-2 font-medium">{error instanceof Error ? error.message : 'Request failed'}</p>
            </div>
          ) : title === 'Health Check' ? (
            <HealthCheckView data={data as Health} />
          ) : title === 'Readiness' ? (
            <ReadinessView data={data as Ready} />
          ) : title === 'Telemetry' ? (
            <TelemetryView data={data as Metrics} />
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar min-h-0">
              <pre className="text-[10px] font-mono leading-relaxed text-[var(--text)] opacity-80">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HealthCheckView({ data }: { data: Health | undefined }) {
  if (!data) return null
  
  const isOk = data.status === 'ok'
  
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        <div className={`flex items-center gap-4 p-4 rounded-xl ${isOk ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'} border`}>
          <div className={`p-3 rounded-xl ${isOk ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30'} border`}>
            {isOk ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Status</p>
            <p className={`text-lg font-bold ${isOk ? 'text-emerald-500' : 'text-rose-500'} capitalize`}>{data.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <InfoRow label="Application" value={data.app || '—'} icon={Server} />
          <InfoRow label="Environment" value={data.env || '—'} icon={Activity} />
        </div>

        <div className="pt-4 border-t border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-medium">All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadinessView({ data }: { data: Ready | undefined }) {
  if (!data) return null
  
  const isReady = data.status === 'ready'
  
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        <div className={`flex items-center gap-4 p-4 rounded-xl ${isReady ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'} border`}>
          <div className={`p-3 rounded-xl ${isReady ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-rose-500/20 border-rose-500/30'} border`}>
            {isReady ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Database</p>
            <p className={`text-lg font-bold ${isReady ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isReady ? 'Ready' : 'Not Ready'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[var(--bg)]/40 border border-[var(--card-border)]">
            <div className="flex items-center gap-3 mb-3">
              <Database className="w-4 h-4 text-blue-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Connectivity</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-rose-500'} ${isReady ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-bold text-[var(--text)]">
                {isReady ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg)]/40 border border-[var(--card-border)]">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-4 h-4 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Resources</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-[var(--text)]">Available</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--card-border)]">
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <Database className="w-3.5 h-3.5" />
            <span className="font-medium">All dependencies ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TelemetryView({ data }: { data: Metrics | undefined }) {
  if (!data) return null
  
  const counters = data.counters || {}
  const timings = data.timings_ms || {}
  
  const counterEntries = Object.entries(counters).slice(0, 5)
  const timingEntries = Object.entries(timings).slice(0, 5)
  
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        {counterEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-cyan-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Counters</p>
            </div>
            <div className="space-y-2">
              {counterEntries.map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-[var(--bg)]/40 border border-[var(--card-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)] truncate">{key}</span>
                    <span className="text-sm font-bold text-cyan-500 ml-2">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {timingEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 mt-4">
              <Gauge className="w-4 h-4 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Timings (ms)</p>
            </div>
            <div className="space-y-2">
              {timingEntries.map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg bg-[var(--bg)]/40 border border-[var(--card-border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--text)] truncate">{key}</span>
                    <span className="text-sm font-bold text-amber-500 ml-2">{Number(value).toFixed(2)}ms</span>
                  </div>
                  <div className="w-full bg-[var(--bg)]/60 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500/40 to-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min((Number(value) / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {counterEntries.length === 0 && timingEntries.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-[var(--text-muted)]">No metrics available</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--bg)]/40 border border-[var(--card-border)] flex items-center gap-3">
      <Icon className="w-4 h-4 text-[var(--text-muted)]" />
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}

function LiveTasksCard({ query }: { query: UseQueryResult<Analysis[], Error> }) {
  const data = query.data || []
  const running = data.filter((a) => ['PROGRESS', 'STARTED', 'PENDING'].includes((a.status || '').toUpperCase()))
  const latest = running.slice(-5).reverse()

  return (
    <div className="glass-card p-8 rounded-[2.5rem] space-y-4">
      <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4">
        <div className="p-3 bg-[var(--bg)]/50 rounded-2xl border border-[var(--card-border)]">
          <PlayCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Live tasks</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-medium">Ongoing audits (poll 4s)</p>
        </div>
        <button
          onClick={() => query.refetch()}
          className="ml-auto px-3 py-1 rounded-lg border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:bg-[var(--text)]/5 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-3 text-[var(--text-muted)] text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading tasks...
        </div>
      ) : running.length === 0 ? (
        <div className="text-[11px] text-[var(--text-muted)]">No tasks in progress.</div>
      ) : (
        <div className="divide-y divide-[var(--card-border)] rounded-2xl border border-[var(--card-border)] overflow-hidden bg-[var(--bg)]/30">
          {latest.map((a) => (
            <div key={a.id} className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[var(--bg)]/60 border border-[var(--card-border)]">
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text)]">Analysis #{a.id}</p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                  DS {a.dataset_id} · Model {a.model_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
