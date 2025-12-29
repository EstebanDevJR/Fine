import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import { api } from '../api/client'
import { useAuth } from '../api/useAuth'
import { 
  AlertTriangle, 
  Loader2, 
  PlayCircle, 
  Database, 
  Cpu, 
  BarChart3, 
  FileText,
  Activity,
  ShieldCheck,
  Zap,
  LayoutDashboard,
  Copy,
  RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type StepStatus = 'idle' | 'running' | 'done' | 'skipped' | 'error'

const STEPS = [
  { key: 'evaluate', title: 'Metrics & QA', description: 'Baseline metrics and dataset sanity', icon: BarChart3 },
  { key: 'xai', title: 'XAI', description: 'Permutation importance + SHAP', icon: Zap },
  { key: 'sensitivity', title: 'Sensitivity', description: 'Light perturbations & drift', icon: Activity },
  { key: 'robustness', title: 'Robustness', description: 'Strong noise and feature masking', icon: ShieldCheck },
  { key: 'fairness', title: 'Fairness', description: 'Parity gaps & impact analysis', icon: AlertTriangle },
  { key: 'diagnose', title: 'LLM Diagnose', description: 'Risks and recommendations', icon: Cpu },
  { key: 'report', title: 'Report', description: 'HTML/PDF generation', icon: FileText },
]

interface Dataset {
  id: number
  name: string
}

interface Model {
  id: number
  name: string
}

interface AuditStatus {
  state: string
  step?: string
  status?: string
  progress?: number
  detail?: string
  analysis_id?: number | null
  trace_id?: string
  trace_url?: string
  result?: {
    fairness?: { skipped?: boolean }
    evaluate?: { metrics?: Record<string, number | string> }
    diagnose?: { 
      summary?: string
      risks?: string[]
      recommendations?: string[]
    }
    report?: {
      txt_path?: string
    }
  }
}

export function AuditPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const datasets = useQuery({ queryKey: ['datasets'], queryFn: api.listDatasets })
  const models = useQuery({ queryKey: ['models'], queryFn: api.listModels })
  const [manualDatasetId, setManualDatasetId] = useState<number | null>(null)
  const [manualModelId, setManualModelId] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<AuditStatus | null>(null)

  const latestDatasetId = useMemo(() => {
    const data = datasets.data as Dataset[] | undefined
    return data?.length ? data[data.length - 1].id : null
  }, [datasets.data])

  const latestModelId = useMemo(() => {
    const data = models.data as Model[] | undefined
    return data?.length ? data[data.length - 1].id : null
  }, [models.data])

  const activeDatasetId = manualDatasetId ?? latestDatasetId
  const activeModelId = manualModelId ?? latestModelId

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/auth' })
    }
  }, [authLoading, user, navigate])

  const startAudit = useMutation<{ job_id: string }, Error, void>({
    mutationFn: () => {
      if (!activeDatasetId || !activeModelId) {
        setFormError('Selecciona un dataset y un modelo')
        throw new Error('Dataset and model are required')
      }
      setFormError(null)
      return api.auditFullStart({ dataset_id: activeDatasetId, model_id: activeModelId }) as Promise<{ job_id: string }>
    },
    onSuccess: (res) => setJobId(res.job_id),
  })

  // SSE stream for live status (fallback polling if SSE fails)
  useEffect(() => {
    if (!jobId) return

    const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'
    const url = `${base}/audit/full/${jobId}/events`

    let closed = false
    const es = new EventSource(url)

    es.addEventListener('status', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as AuditStatus
        if (closed) return
        setStreamStatus(data)
        setLastUpdate(new Date().toLocaleTimeString())
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener('done', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as AuditStatus
        if (closed) return
        setStreamStatus(data)
        setLastUpdate(new Date().toLocaleTimeString())
      } finally {
        es.close()
      }
    })

    es.onerror = () => {
      // If SSE fails (proxy/buffer), fallback to polling.
      es.close()
      ;(async () => {
        try {
          const data = (await api.auditFullStatus(jobId)) as AuditStatus
          if (closed) return
          setStreamStatus(data)
          setLastUpdate(new Date().toLocaleTimeString())
        } catch {
          // ignore
        }
      })()
    }

    return () => {
      closed = true
      es.close()
    }
  }, [jobId])

  const statusData = streamStatus
  const result = statusData?.result
  const progress = statusData?.progress ?? (statusData?.state === 'SUCCESS' ? 1 : 0)
  const analysisId = statusData?.analysis_id
  const traceId = statusData?.trace_id
  const traceUrl = statusData?.trace_url

  useEffect(() => {
    if (statusData?.state === 'SUCCESS') {
      qc.invalidateQueries({ queryKey: ['analyses'] })
    }
  }, [statusData?.state, qc])

  const datasetsList = (datasets.data as Dataset[] | undefined) ?? []
  const modelsList = (models.data as Model[] | undefined) ?? []
  const nothingToRun = !datasetsList.length || !modelsList.length

  const stepStates = useMemo(() => {
    const order = STEPS.map((s) => s.key)
    const activeStep = statusData?.step
    const activeIndex = activeStep ? order.indexOf(activeStep) : -1
    const overall = statusData?.state

    return STEPS.map((s, idx) => {
      let status: StepStatus = 'idle'

      if (overall === 'SUCCESS') {
        if (s.key === 'fairness' && result?.fairness?.skipped) status = 'skipped'
        else status = 'done'
      } else if (overall === 'FAILURE') {
        if (activeIndex === -1) status = 'error'
        else if (idx < activeIndex) status = 'done'
        else if (idx === activeIndex) status = 'error'
      } else if (overall === 'PROGRESS' || overall === 'STARTED') {
        if (activeIndex === -1) status = idx === 0 ? 'running' : 'idle'
        else if (idx < activeIndex) status = 'done'
        else if (idx === activeIndex) status = statusData?.status === 'skipped' ? 'skipped' : 'running'
      }

      return { ...s, status }
    })
  }, [statusData, result])

  if (authLoading || (!user && authLoading === false)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide animate-pulse">Initializing secure audit environment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-2">Audit Dashboard</h1>
          <p className="text-[var(--text-muted)] font-medium">Model vulnerability and performance analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-emerald-500">
            <Activity className="h-3.5 w-3.5" />
            SYSTEM OPERATIONAL
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Datasets" value={datasetsList.length} icon={Database} color="emerald" />
        <StatCard label="Models" value={modelsList.length} icon={Cpu} color="blue" />
        <StatCard label="Active Jobs" value={jobId ? 1 : 0} icon={LayoutDashboard} color="amber" />
        <StatCard label="Security" value="Enterprise" icon={ShieldCheck} color="cyan" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,350px]">
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2rem] space-y-8">
            <div className="flex items-center gap-4 border-b border-[var(--card-border)] pb-6">
              <div className="p-3 bg-[var(--bg)]/50 rounded-2xl border border-[var(--card-border)]">
                <PlayCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">Audit Configuration</h2>
                <p className="text-sm text-[var(--text-muted)] font-medium">Configure and launch autonomous audit agents</p>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Target Dataset</label>
                <select
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-5 py-4 text-sm text-[var(--text)] outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                  value={activeDatasetId ?? ''}
                  onChange={(e) => setManualDatasetId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select dataset</option>
                  {(datasets.data as Dataset[] || []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name ?? `Dataset ${d.id}`}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Target Model</label>
                <select
                  className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-5 py-4 text-sm text-[var(--text)] outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                  value={activeModelId ?? ''}
                  onChange={(e) => setManualModelId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select model</option>
                  {(models.data as Model[] || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name ?? `Model ${m.id}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              <button
                onClick={() => {
                  setManualDatasetId(latestDatasetId)
                  setManualModelId(latestModelId)
                }}
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
              >
                Usar últimos assets
              </button>
              <Link
                to="/upload"
                className="px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
              >
                Subir nuevos
              </Link>
              {formError && <span className="text-rose-500">{formError}</span>}
            </div>

            {nothingToRun && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-600 flex items-center justify-between">
                <span>Sube al menos un dataset y un modelo para lanzar la auditoría.</span>
                <Link
                  to="/upload"
                  className="px-3 py-1 rounded-lg bg-[var(--text)] text-[var(--bg)] text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90"
                >
                  Ir a Upload
                </Link>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-6">
              <button
                disabled={startAudit.isPending || nothingToRun || (jobId !== null && statusData?.state !== 'SUCCESS' && statusData?.state !== 'FAILURE')}
                onClick={() => startAudit.mutate()}
                className={`w-full sm:w-auto px-10 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                  startAudit.isPending || nothingToRun ? 'bg-[var(--card-border)] text-[var(--text-muted)]' : 'bg-[var(--text)] text-[var(--bg)] hover:scale-[1.02] shadow-xl'
                }`}
              >
                {startAudit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Launch Full Audit
              </button>
              
              {startAudit.isError && (
                <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-tight bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20">
                  <AlertTriangle className="h-4 w-4" />
                  {String((startAudit.error as Error).message)}
                </div>
              )}
              {/* SSE is best-effort; errors fall back to a one-shot fetch */}
            </div>

            {jobId && (
              <div className="space-y-4 p-6 bg-[var(--bg)]/30 rounded-[2rem] border border-[var(--card-border)] animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-[var(--text)]">{statusData?.step ? `Processing: ${statusData.step}` : 'Initializing pipeline...'}</span>
                  </div>
                  <span className="text-lg font-black text-emerald-500 font-mono">{Math.round((progress || 0) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-[var(--card-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  <span className="font-black uppercase tracking-[0.2em]">Job</span>
                  <code className="px-2 py-1 rounded bg-[var(--bg)]/60 border border-[var(--card-border)] text-[var(--text)]">
                    {jobId}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(jobId)}
                    className="px-2 py-1 rounded-lg border border-[var(--card-border)] hover:bg-[var(--text)]/5 flex items-center gap-1 text-[var(--text-muted)]"
                    title="Copiar Job ID"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                  <button
                    onClick={async () => {
                      if (!jobId) return
                      const data = (await api.auditFullStatus(jobId)) as AuditStatus
                      setStreamStatus(data)
                      setLastUpdate(new Date().toLocaleTimeString())
                    }}
                    className="px-2 py-1 rounded-lg border border-[var(--card-border)] hover:bg-[var(--text)]/5 flex items-center gap-1 text-[var(--text-muted)]"
                    title="Refrescar estado"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                  {lastUpdate && <span className="ml-auto">Última actualización: {lastUpdate}</span>}
                </div>
                {(traceUrl || traceId) && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-500">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="font-black uppercase tracking-[0.2em]">Trace</span>
                    {traceUrl ? (
                      <a
                        href={traceUrl}
                        target="_blank"
                        className="underline underline-offset-2 hover:text-emerald-400"
                      >
                        Abrir
                      </a>
                    ) : (
                      <code className="px-2 py-1 rounded bg-[var(--bg)]/60 border border-[var(--card-border)] text-[var(--text)]">
                        {traceId}
                      </code>
                    )}
                  </div>
                )}
                {statusData?.detail && (
                  <div className="text-[11px] text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                    {statusData.detail}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stepStates.map((s) => {
              const { key, ...stepProps } = s
              return <StepItem key={key} {...stepProps} />
            })}
          </div>
        </div>

        <div className="space-y-6">
          <LiveActivityCard statusData={statusData} />
          <ResultSummary result={result} state={statusData?.state} analysisId={analysisId} />
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
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
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

function StepItem({
  title,
  description,
  status,
  icon: Icon,
}: {
  title: string
  description: string
  status: StepStatus
  icon: LucideIcon
}) {
  const configs: Record<StepStatus, { border: string; text: string; icon: string }> = {
    idle: { border: 'border-[var(--card-border)]', text: 'text-[var(--text-muted)]', icon: 'bg-[var(--bg)]/50' },
    running: { border: 'border-blue-500/30', text: 'text-blue-500', icon: 'bg-blue-500/10 animate-pulse' },
    done: { border: 'border-emerald-500/30', text: 'text-emerald-500', icon: 'bg-emerald-500/10' },
    skipped: { border: 'border-amber-500/30', text: 'text-amber-500', icon: 'bg-amber-500/10' },
    error: { border: 'border-rose-500/30', text: 'text-rose-500', icon: 'bg-rose-500/10' },
  }

  const cfg = configs[status]

  return (
    <div className={`glass-card p-5 rounded-3xl border-2 flex flex-col gap-4 transition-all duration-500 ${cfg.border}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl border border-[var(--card-border)] ${cfg.icon}`}>
          <Icon className={`w-5 h-5 ${cfg.text}`} />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-[var(--card-border)] ${cfg.text}`}>
          {status}
        </span>
      </div>
      <div>
        <h4 className="font-bold text-[var(--text)] text-sm mb-1">{title}</h4>
        <p className="text-[10px] text-[var(--text-muted)] font-medium leading-relaxed uppercase tracking-tighter">{description}</p>
      </div>
    </div>
  )
}

function LiveActivityCard({ statusData }: { statusData: AuditStatus | null }) {
  const state = statusData?.state || 'IDLE'
  return (
    <div className="glass-card p-6 rounded-[2rem] space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4">
        <div>
          <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Activity</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-medium">Pipeline signals</p>
        </div>
        <div className={`h-3 w-3 rounded-full ${state === 'PROGRESS' ? 'bg-blue-500 animate-ping' : 'bg-[var(--text-muted)] opacity-30'}`} />
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-[var(--bg)]/30 rounded-2xl border border-[var(--card-border)]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 opacity-50">State</p>
          <p className="text-sm font-bold text-[var(--text)]">{state}</p>
        </div>
        <div className="p-4 bg-[var(--bg)]/30 rounded-2xl border border-[var(--card-border)]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1 opacity-50">Agent Step</p>
          <p className="text-sm font-bold text-[var(--text)]">{statusData?.step || 'No active step'}</p>
        </div>
      </div>
    </div>
  )
}

function ResultSummary({
  result,
  state,
  analysisId,
}: {
  result: AuditStatus['result']
  state?: string
  analysisId?: number | null
}) {
  const navigate = useNavigate()

  if (!result || state !== 'SUCCESS') return null

  return (
    <div className="glass-card p-6 rounded-[2rem] border-emerald-500/20 bg-emerald-500/5 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-3 border-b border-emerald-500/10 pb-4">
        <ShieldCheck className="w-5 h-5 text-emerald-500" />
        <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Summary</h3>
      </div>
      
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)] italic leading-relaxed font-medium">
          "{result?.diagnose?.summary || 'No summary available'}"
        </p>
        
        <div className="flex flex-wrap gap-2">
          {result?.diagnose?.risks?.slice(0, 3).map((r: string, i: number) => (
            <span key={i} className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase rounded-lg">
              {r}
            </span>
          ))}
        </div>

        <div className="pt-4 space-y-2">
            {analysisId && (
              <button
                onClick={async () => {
                  const blob = await api.downloadAnalysisReportTxt(analysisId)
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `analysis-${analysisId}-report.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="w-full py-3 bg-[var(--text)] text-[var(--bg)] rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                <FileText className="w-4 h-4" />
                Download TXT Report
              </button>
            )}
            <button
              onClick={() => navigate({ to: '/analyses', search: analysisId ? { id: analysisId } : {} })}
              className="w-full py-3 border border-emerald-500/30 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500/10 transition-all"
            >
              View in Analyses
            </button>
        </div>
      </div>
    </div>
  )
}
