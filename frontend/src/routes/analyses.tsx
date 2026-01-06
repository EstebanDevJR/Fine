import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api/client'
import { useAuth } from '../api/useAuth'
import type { Analysis as ApiAnalysis } from '../api/schemas'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart2,
  CheckCircle2,
  Clock3,
  FileText,
  Download,
  LineChart,
  LayoutList,
  Loader2,
  Search,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Trash2,
} from 'lucide-react'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type EvaluateBlock = {
  metrics?: Record<string, number | string>
  n_samples?: number
  n_features?: number
  n_classes?: number
  problem_type?: string
}
type SensitivityBlock = { label_flip_rate?: number; proba_shift_mean?: number }
type RobustnessBlock = {
  metric_drop?: number
  missing_feature_impact?: { metric_drop?: number; top_features?: string[] }
}
type FairnessBlock = {
  skipped?: boolean
  reason?: string
  demographic_parity_diff?: number
  disparate_impact?: number
  equal_opportunity_diff?: number
  predictive_equality_diff?: number
} & Record<string, unknown>
type DiagnoseBlock = { summary?: string; risks?: string[]; recommendations?: string[] }
type XaiBlock = Record<string, unknown>

function getEvalMetrics(result: unknown): Record<string, unknown> | undefined {
  if (!isRecord(result)) return undefined
  const evalRes = result['evaluate']
  if (!isRecord(evalRes)) return undefined
  const metrics = evalRes['metrics']
  return isRecord(metrics) ? metrics : undefined
}

type Analysis = {
  id: number
  status: string
  dataset_id: number
  model_id: number
  report_path?: string | null
  pdf_path?: string | null
  result?: Record<string, unknown> | null
  created_at: string
}

const statusStyles: Record<string, { text: string; bg: string; dot: string }> = {
  SUCCESS: { text: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500' },
  FAILURE: { text: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-500' },
  PROGRESS: { text: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
  STARTED: { text: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
  PENDING: { text: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' },
}

export function AnalysesPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const initialSelectedId = (() => {
    const search = new URLSearchParams(window.location.search)
    const fromParam = search.get('id')
    const parsed = fromParam ? Number(fromParam) : Number.NaN
    return Number.isFinite(parsed) ? parsed : null
  })()
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId)
  const [showRaw, setShowRaw] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/auth' })
  }, [authLoading, user, navigate])

  const listQuery = useQuery<ApiAnalysis[]>({
    queryKey: ['analyses'],
    queryFn: api.listAnalyses,
    enabled: Boolean(user),
  })

  const effectiveSelectedId = useMemo(() => {
    if (selectedId) return selectedId
    if (initialSelectedId) return initialSelectedId
    const data = listQuery.data
    if (!data || data.length === 0) return null
    return data[data.length - 1].id
  }, [initialSelectedId, listQuery.data, selectedId])

  const detailQuery = useQuery<ApiAnalysis>({
    queryKey: ['analysis', effectiveSelectedId],
    queryFn: () => api.getAnalysis(effectiveSelectedId as number),
    enabled: Boolean(effectiveSelectedId),
  })

  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  const deleteAnalysis = useMutation({
    mutationFn: async (id: number) => {
      await api.deleteAnalysis(id)
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['analyses'] })
      if (effectiveSelectedId === id) setSelectedId(null)
      setPendingDelete(null)
      // Redirect to dashboard after successful deletion
      navigate({ to: '/dashboard' })
    },
  })

  const selected = detailQuery.data as unknown as Analysis | undefined
  const statusKey = (selected?.status || '').toUpperCase()
  const statusCfg = statusStyles[statusKey] || statusStyles.PENDING

  const total = listQuery.data?.length ?? 0
  const createdAt = selected?.created_at ?? null
  const lastUpdated = createdAt ? new Date(createdAt).toLocaleString() : ''

  const renderDeleteModal = () => {
    if (!pendingDelete) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--bg)] shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text)]">Confirm deletion</p>
              <p className="text-[11px] text-[var(--text-muted)]">The analysis and its artifacts will be deleted.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => deleteAnalysis.mutate(pendingDelete)}
              className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:brightness-110 transition-colors disabled:opacity-70"
              disabled={deleteAnalysis.isPending}
            >
              {deleteAnalysis.isPending ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setPendingDelete(null)}
              className="flex-1 py-3 rounded-xl border border-[var(--card-border)] text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] hover:bg-[var(--text)]/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (authLoading || (!user && authLoading === false)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide animate-pulse">Syncing analysis vault...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text)] mb-2">Analyses</h1>
          <p className="text-[var(--text-muted)] font-medium">Review completed audits, reports, and diagnostics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            OWNER-BOUND
          </div>
          <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold text-blue-500">
            <Activity className="h-3.5 w-3.5" />
            LIVE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px,1fr]">
        <div className="glass-card p-6 rounded-[2rem] space-y-4">
          <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4">
            <div className="p-2.5 bg-[var(--bg)]/50 rounded-xl border border-[var(--card-border)]">
              <LayoutList className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Analysis Vault</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Completed audits per user</p>
            </div>
            <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{total} saved</span>
          </div>

          <div className="relative">
            <input
              className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-10 py-3 text-sm text-[var(--text)] outline-none focus:border-amber-500/50 transition-all"
              placeholder="Filter (by id, dataset, model)"
              disabled
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="divide-y divide-[var(--card-border)] rounded-2xl border border-[var(--card-border)] overflow-hidden bg-[var(--bg)]/30">
            {listQuery.isLoading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-[var(--card-border)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 bg-[var(--card-border)] rounded" />
                      <div className="h-2.5 w-1/4 bg-[var(--card-border)] rounded" />
                    </div>
                  </div>
                ))
            ) : !listQuery.data || listQuery.data.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-muted)] text-xs font-bold uppercase tracking-[0.25em]">
                No analyses yet
              </div>
            ) : (
              listQuery.data
                .slice()
                .reverse()
                .map((a) => {
                  const cfg = statusStyles[(a.status || '').toUpperCase()] || statusStyles.PENDING
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left p-5 flex items-center gap-4 transition-colors ${
                        selectedId === a.id ? 'bg-[var(--text)]/5' : 'hover:bg-[var(--text)]/5'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-xl border ${cfg.bg} flex items-center justify-center`}>
                        <BarChart2 className={`w-5 h-5 ${cfg.text}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[var(--text)]">Analysis #{a.id}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-widest">
                          DS {a.dataset_id} · Model {a.model_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>{a.status}</span>
                      </div>
                    </button>
                  )
                })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2.5rem] min-h-[320px] border border-[var(--card-border)]">
            <div className="flex items-center gap-3 border-b border-[var(--card-border)] pb-4 mb-4">
              <div className="p-2.5 bg-[var(--bg)]/50 rounded-xl border border-[var(--card-border)]">
                <FileText className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--text)] uppercase tracking-[0.2em]">Details</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">Report links and outcomes</p>
              </div>
              {selected && (
                <button
                  onClick={() => setPendingDelete(selected.id)}
                  className="ml-auto px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            {detailQuery.isLoading ? (
              <div className="flex h-[200px] items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : !selected ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-[var(--text-muted)] text-xs font-bold uppercase tracking-[0.25em]">
                Select an analysis
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${statusCfg.bg} ${statusCfg.text}`}>
                    {selected.status}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock3 className="w-3.5 h-3.5" />
                    {lastUpdated || '—'}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <InfoBadge label="Dataset" value={`#${selected.dataset_id}`} icon={<Zap className="w-4 h-4 text-amber-500" />} />
                  <InfoBadge label="Model" value={`#${selected.model_id}`} icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />} />
                </div>

                <div className="flex flex-wrap gap-3">
                  {selected.result && (
                    <button
                      onClick={() => {
                        if (isRecord(selected.result)) downloadResult(selected.result, selected.id)
                      }}
                      className="px-4 py-3 rounded-xl border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download JSON
                    </button>
                  )}
                  {selected?.report_path && (
                    <button
                      onClick={async () => {
                        const blob = await api.downloadAnalysisReportTxt(selected.id)
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `analysis-${selected.id}-report.txt`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="px-4 py-3 rounded-xl border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      Download TXT
                    </button>
                  )}
                </div>

                <KeyMetrics metrics={getEvalMetrics(selected.result)} />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Render</span>
                  </div>
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border border-[var(--card-border)] text-[var(--text)] hover:bg-[var(--text)]/5 transition-colors"
                  >
                    {showRaw ? 'Simple view' : 'View JSON'}
                  </button>
                </div>

                {showRaw && selected.result ? (
                  <div className="rounded-2xl bg-[var(--bg)]/40 border border-[var(--card-border)] p-4 max-h-[70vh] overflow-hidden flex flex-col min-w-0">
                    <pre className="text-[11px] font-mono leading-relaxed text-[var(--text)] opacity-80 overflow-auto flex-1 custom-scrollbar min-w-0" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selected.result, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <ResultPanels
                    result={selected.result}
                    analysisId={selected.id}
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-4 gap-4">
            <MetricCard icon={BarChart2} label="Analyses" value={total} color="emerald" />
            <MetricCard icon={CheckCircle2} label="Completed" value={listQuery.data?.filter((a) => a.status === 'SUCCESS').length ?? 0} color="blue" />
            <MetricCard icon={AlertTriangle} label="Failed" value={listQuery.data?.filter((a) => a.status === 'FAILURE').length ?? 0} color="rose" />
            <MetricCard icon={LineChart} label="Last 7 days" value={trendLabel(listQuery.data)} color="amber" />
          </div>
        </div>
      </div>
      {renderDeleteModal()}
    </div>
  )
}

function trendLabel(data?: Analysis[]) {
  if (!data?.length) return '0'
  const now = new Date()
  let count = 0
  data.forEach((a) => {
    const d = new Date(a.created_at)
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    if (diff <= 7) count += 1
  })
  return String(count)
}

function downloadResult(result: Record<string, unknown>, id?: number) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analysis-${id || 'result'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

type MetricColor = 'emerald' | 'blue' | 'rose' | 'amber'

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  color: MetricColor
}) {
  const colors: Record<MetricColor, string> = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  }

  return (
    <div className="glass-card p-4 rounded-2xl border flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl border ${colors[color]} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
        <p className="text-xl font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}

function InfoBadge({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/40 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-[var(--bg)]/50 border border-[var(--card-border)]">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  )
}

function ResultPanels({
  result,
  analysisId,
}: {
  result?: Record<string, unknown> | null
  analysisId?: number
}) {
  if (!result) {
    return (
      <div className="rounded-2xl bg-[var(--bg)]/40 border border-[var(--card-border)] p-4">
        <p className="text-[11px] text-[var(--text-muted)]">No result payload stored.</p>
      </div>
    )
  }

  const evalRes: EvaluateBlock | null = (() => {
    const raw = result['evaluate']
    if (!isRecord(raw)) return null
    const metricsRaw = raw['metrics']
    const metrics: Record<string, number | string> | undefined = (() => {
      if (!isRecord(metricsRaw)) return undefined
      const out: Record<string, number | string> = {}
      for (const [k, v] of Object.entries(metricsRaw)) {
        if (typeof v === 'number' || typeof v === 'string') out[k] = v
      }
      return out
    })()
    return {
      metrics,
      n_samples: typeof raw['n_samples'] === 'number' ? raw['n_samples'] : undefined,
      n_features: typeof raw['n_features'] === 'number' ? raw['n_features'] : undefined,
      n_classes: typeof raw['n_classes'] === 'number' ? raw['n_classes'] : undefined,
      problem_type: typeof raw['problem_type'] === 'string' ? raw['problem_type'] : undefined,
    }
  })()

  const xai: XaiBlock | null = (() => {
    const raw = result['xai']
    return isRecord(raw) ? (raw as Record<string, unknown>) : null
  })()

  const sensitivity: SensitivityBlock | null = (() => {
    const raw = result['sensitivity']
    if (!isRecord(raw)) return null
    return {
      label_flip_rate: typeof raw['label_flip_rate'] === 'number' ? raw['label_flip_rate'] : undefined,
      proba_shift_mean: typeof raw['proba_shift_mean'] === 'number' ? raw['proba_shift_mean'] : undefined,
    }
  })()

  const robustness: RobustnessBlock | null = (() => {
    const raw = result['robustness']
    if (!isRecord(raw)) return null
    const mfi = raw['missing_feature_impact']
    const mfiRec = isRecord(mfi) ? (mfi as Record<string, unknown>) : null
    return {
      metric_drop: typeof raw['metric_drop'] === 'number' ? raw['metric_drop'] : undefined,
      missing_feature_impact: mfiRec
        ? {
            metric_drop: typeof mfiRec['metric_drop'] === 'number' ? (mfiRec['metric_drop'] as number) : undefined,
            top_features: Array.isArray(mfiRec['top_features'])
              ? (mfiRec['top_features'] as unknown[]).filter((x): x is string => typeof x === 'string')
              : undefined,
          }
        : undefined,
    }
  })()

  const fairness: FairnessBlock | null = (() => {
    const raw = result['fairness']
    return isRecord(raw) ? (raw as FairnessBlock) : null
  })()

  const diagnose: DiagnoseBlock | null = (() => {
    const raw = result['diagnose']
    if (!isRecord(raw)) return null
    return {
      summary: typeof raw['summary'] === 'string' ? raw['summary'] : undefined,
      risks: Array.isArray(raw['risks']) ? (raw['risks'] as unknown[]).filter((x): x is string => typeof x === 'string') : undefined,
      recommendations: Array.isArray(raw['recommendations'])
        ? (raw['recommendations'] as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
    }
  })()

  return (
    <div className="space-y-4">
      <SummaryStrip result={result} />

      {evalRes && (
        <Section title="Metrics" icon={<BarChart2 className="w-4 h-4 text-emerald-400" />}>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(evalRes.metrics || {}).map(([k, v]) => (
              <MetricBar key={k} label={k} value={Number(v)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em]">
            {evalRes.n_samples !== undefined && <Pill label="Samples" value={evalRes.n_samples} />}
            {evalRes.n_features !== undefined && <Pill label="Features" value={evalRes.n_features} />}
            {evalRes.n_classes !== undefined && <Pill label="Classes" value={evalRes.n_classes} />}
          </div>
        </Section>
      )}

      {xai && (
        <Section title="XAI" icon={<Zap className="w-4 h-4 text-amber-400" />}>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Permutation importance</p>
            <div className="space-y-2">
              {(() => {
                const pi = xai['permutation_importance']
                if (!Array.isArray(pi)) return null
                return (pi as Array<unknown>)
                  .map((raw) => (isRecord(raw) ? raw : null))
                  .filter(Boolean)
                  .map((item) => {
                    const feature = typeof item!['feature'] === 'string' ? (item!['feature'] as string) : 'feature'
                    const val = Number(item!['importance_mean'] ?? 0)
                    return <MetricBar key={feature} label={feature} value={val} />
                  })
              })()}
            </div>
          </div>
          {isRecord(xai['shap_summary']) && Array.isArray((xai['shap_summary'] as Record<string, unknown>)['feature_names']) && (
            <div className="pt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">SHAP mean |abs|</p>
              <div className="space-y-2">
                {((xai['shap_summary'] as Record<string, unknown>)['feature_names'] as string[]).map((name: string, idx: number) => (
                  <MetricBar
                    key={name}
                    label={name}
                    value={Number(((xai['shap_summary'] as Record<string, unknown>)['global_mean_abs'] as unknown[] | undefined)?.[idx] ?? 0)}
                    colorClass="bg-blue-500/70"
                  />
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {(sensitivity || robustness) && (
        <Section title="Resilience" icon={<ShieldCheck className="w-4 h-4 text-cyan-400" />}>
          <div className="grid sm:grid-cols-2 gap-3">
            {sensitivity?.label_flip_rate !== undefined && (
              <MetricBar label="Label flip rate" value={sensitivity.label_flip_rate} colorClass="bg-amber-500/70" />
            )}
            {sensitivity?.proba_shift_mean !== undefined && (
              <MetricBar label="Proba shift" value={sensitivity.proba_shift_mean} colorClass="bg-amber-500/70" />
            )}
            {robustness?.metric_drop !== undefined && (
              <MetricBar label="Metric drop" value={robustness.metric_drop} colorClass="bg-rose-500/70" />
            )}
            {robustness?.missing_feature_impact?.metric_drop !== undefined && (
              <MetricBar label="Missing feature drop" value={robustness.missing_feature_impact.metric_drop} colorClass="bg-rose-500/70" />
            )}
          </div>
          {robustness?.missing_feature_impact?.top_features && (
            <p className="text-[11px] text-[var(--text-muted)] mt-2">Top sensitive features: {robustness.missing_feature_impact.top_features.join(', ')}</p>
          )}
        </Section>
      )}

      {fairness && (
        <Section title="Fairness" icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
          {fairness.skipped ? (
            <p className="text-[11px] text-[var(--text-muted)]">Skipped: {fairness.reason || 'No sensitive attribute provided'}</p>
          ) : (
            <pre className="text-[11px] font-mono leading-relaxed text-[var(--text)] opacity-80 overflow-auto max-h-[240px] custom-scrollbar bg-[var(--bg)]/40 rounded-xl p-3 border border-[var(--card-border)]">
              {JSON.stringify(fairness, null, 2)}
            </pre>
          )}
        </Section>
      )}

      {diagnose && (
        <Section title="Diagnosis" icon={<Activity className="w-4 h-4 text-emerald-400" />}>
          <DiagnosisNarrative summary={diagnose.summary} risks={diagnose.risks} recommendations={diagnose.recommendations} />
        </Section>
      )}

      <Section title="Report viewer" icon={<FileText className="w-4 h-4 text-blue-400" />}>
        <ReportViewer 
          result={result}
          evalRes={evalRes}
          xai={xai}
          sensitivity={sensitivity}
          robustness={robustness}
          fairness={fairness}
          diagnose={diagnose}
        />
      </Section>

      <Section title="Report actions" icon={<Download className="w-4 h-4 text-emerald-400" />}>
        <div className="flex flex-wrap gap-3">
          {result && (
            <button
              onClick={() => downloadResult(result, analysisId)}
              className="px-4 py-3 rounded-xl border border-[var(--card-border)] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-[var(--text)] hover:text-[var(--bg)] transition-all"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--bg)]/40 border border-[var(--card-border)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</p>
      </div>
      {children}
    </div>
  )
}

function MetricBar({ label, value, colorClass = 'bg-emerald-500/70' }: { label: string; value: number; colorClass?: string }) {
  const pct = Number.isFinite(value) ? Math.min(Math.abs(value) * 100, 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-[var(--text)] mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-[var(--text-muted)] font-mono">{value?.toFixed ? value.toFixed(3) : value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--card-border)] overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: unknown }) {
  return (
    <span className="px-2 py-1 rounded-lg border border-[var(--card-border)] bg-[var(--bg)]/40 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
      {label}: {value === null || value === undefined ? '—' : String(value)}
    </span>
  )
}

function KeyMetrics({ metrics }: { metrics?: Record<string, unknown> }) {
  if (!metrics || Object.keys(metrics).length === 0) return null
  const entries = Object.entries(metrics).slice(0, 4)
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/40 p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Key metrics</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {entries.map(([k, v]) => (
          <div key={k} className="p-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/60">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{k}</p>
            <p className="text-sm font-bold text-[var(--text)]">
              {Number.isFinite(Number(v)) ? Number(v).toFixed(3) : String(v)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryStrip({ result }: { result: Record<string, unknown> }) {
  const metrics = getEvalMetrics(result) || {}
  const fairness = isRecord(result) ? result['fairness'] : undefined
  const diag = isRecord(result) ? result['diagnose'] : undefined

  const fmt = (v: unknown) => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
    if (typeof v === 'number') return v.toFixed(3)
    return String(v)
  }

  const items = [
    { label: 'Accuracy', value: fmt(metrics['accuracy']) },
    { label: 'F1', value: fmt((metrics['f1_macro'] as unknown) ?? metrics['f1']) },
    { label: 'ROC AUC', value: fmt(metrics['roc_auc']) },
    { label: 'PR AUC', value: fmt(metrics['pr_auc']) },
    isRecord(fairness) && fairness['skipped']
      ? { label: 'Fairness', value: 'Skipped' }
      : fairness
        ? { label: 'Fairness', value: 'Checked' }
        : null,
    isRecord(diag) && typeof diag['summary'] === 'string'
      ? {
          label: 'Diagnosis',
          value: (diag['summary'] as string).length > 60 ? `${(diag['summary'] as string).slice(0, 60)}…` : (diag['summary'] as string),
        }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  if (!items.length) return null
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/40">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">{item.label}</p>
          <p className="text-sm font-bold text-[var(--text)]">{item.value || '—'}</p>
        </div>
      ))}
    </div>
  )
}

function stripJsonString(text: string) {
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed === 'string') return parsed
    if (typeof parsed === 'object') return JSON.stringify(parsed, null, 2)
    return text
  } catch {
    return text
  }
}

function DiagnosisNarrative({
  summary,
  risks,
  recommendations,
}: {
  summary?: string
  risks?: string[]
  recommendations?: string[]
}) {
  const textSummary = stripJsonString(summary || '')
  const riskList = risks || []
  const recList = recommendations || []

  const riskSentence =
    riskList.length > 0
      ? `Detected risks: ${riskList.map((r, i) => `${i + 1}) ${r}`).join(' ')}`
      : 'No specific risks were reported.'

  const recSentence =
    recList.length > 0
      ? `Key recommendations: ${recList.map((r, i) => `${i + 1}) ${r}`).join(' ')}`
      : 'No additional recommendations.'

  return (
    <div className="space-y-3">
      {textSummary && (
        <p className="text-[13px] leading-relaxed text-[var(--text)] bg-[var(--bg)]/40 border border-[var(--card-border)] rounded-xl p-3">
          {textSummary}
        </p>
      )}
      <p className="text-[12px] leading-relaxed text-[var(--text)] bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
        {riskSentence}
      </p>
      <p className="text-[12px] leading-relaxed text-[var(--text)] bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
        {recSentence}
      </p>
    </div>
  )
}

function ReportViewer({
  result,
  evalRes,
  xai,
  sensitivity,
  robustness,
  fairness,
  diagnose,
}: {
  result?: Record<string, unknown> | null
  evalRes?: EvaluateBlock | null
  xai?: XaiBlock | null
  sensitivity?: SensitivityBlock | null
  robustness?: RobustnessBlock | null
  fairness?: FairnessBlock | null
  diagnose?: DiagnoseBlock | null
}) {
  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return 'N/A'
    if (typeof v === 'number') {
      if (Math.abs(v) < 0.0001) return v.toExponential(2)
      if (Math.abs(v) >= 1000) return v.toFixed(2)
      return v.toFixed(4)
    }
    return String(v)
  }

  const formatPercent = (v: unknown): string => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return 'N/A'
    return `${(Number(v) * 100).toFixed(2)}%`
  }

  // Generate the full scientific report in Markdown (expensive; memoized below)
  const generateReport = useCallback((): string => {
    if (!result) return 'No analysis data available to generate report.'

    let report = ''
    
    // Title and Header
    report += '# Model Audit Report\n\n'
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`
    report += '---\n\n'
    
    // Executive Summary
    report += '## 1. Executive Summary\n\n'
    
    if (diagnose?.summary) {
      report += stripJsonString(diagnose.summary) + '\n\n'
    } else {
      report += 'This report presents a comprehensive analysis of the machine learning model performance, '
      report += 'interpretability, robustness, and fairness characteristics.\n\n'
    }
    
    // Dataset and Model Information
    if (evalRes) {
      report += '### Dataset Characteristics\n\n'
      report += '| Characteristic | Value |\n'
      report += '|----------------|-------|\n'
      if (evalRes.n_samples !== undefined) report += `| Number of samples | ${evalRes.n_samples} |\n`
      if (evalRes.n_features !== undefined) report += `| Number of features | ${evalRes.n_features} |\n`
      if (evalRes.n_classes !== undefined) report += `| Number of classes | ${evalRes.n_classes} |\n`
      if (evalRes.problem_type) report += `| Problem type | ${evalRes.problem_type} |\n`
      report += '\n'
    }
    
    // Model Performance
    if (evalRes?.metrics) {
      report += '## 2. Model Performance Metrics\n\n'
      
      const metrics = evalRes.metrics
      report += 'The model was evaluated using standard performance metrics:\n\n'
      
      if (metrics.accuracy !== undefined) {
        report += `### Accuracy: ${formatPercent(metrics.accuracy)}\n\n`
        report += `The model correctly classifies ${formatPercent(metrics.accuracy)} of the test instances.\n\n`
      }
      
      if (metrics.precision !== undefined) {
        report += `### Precision: ${formatValue(metrics.precision)}\n\n`
        report += `Of all positive predictions, ${formatPercent(metrics.precision)} are correct.\n\n`
      }
      
      if (metrics.recall !== undefined) {
        report += `### Recall: ${formatValue(metrics.recall)}\n\n`
        report += `The model identifies ${formatPercent(metrics.recall)} of all actual positive cases.\n\n`
      }
      
      if (metrics.f1_score !== undefined || metrics.f1 !== undefined || metrics.f1_macro !== undefined) {
        const f1 = metrics.f1_score || metrics.f1 || metrics.f1_macro
        report += `### F1-Score: ${formatValue(f1)}\n\n`
        report += `Harmonic mean of precision and recall: ${formatValue(f1)}.\n\n`
      }
      
      if (metrics.roc_auc !== undefined) {
        report += `### ROC-AUC: ${formatValue(metrics.roc_auc)}\n\n`
        const aucVal = Number(metrics.roc_auc)
        if (aucVal >= 0.9) {
          report += `**Excellent discriminative ability** (AUC ≥ 0.9).\n\n`
        } else if (aucVal >= 0.8) {
          report += `**Good discriminative ability** (0.8 ≤ AUC < 0.9).\n\n`
        } else if (aucVal >= 0.7) {
          report += `**Acceptable discriminative ability** (0.7 ≤ AUC < 0.8).\n\n`
        } else {
          report += `**⚠️ Poor discriminative ability** (AUC < 0.7). Model may require improvement.\n\n`
        }
      }
      
      if (metrics.pr_auc !== undefined) {
        report += `### PR-AUC: ${formatValue(metrics.pr_auc)}\n\n`
        report += `Precision-Recall area under curve: ${formatValue(metrics.pr_auc)}.\n\n`
      }
      
      // Additional metrics
      const otherMetrics = Object.entries(metrics).filter(([k]) => 
        !['accuracy', 'precision', 'recall', 'f1_score', 'f1', 'f1_macro', 'roc_auc', 'pr_auc'].includes(k)
      )
      if (otherMetrics.length > 0) {
        report += '### Additional Metrics\n\n'
        report += '| Metric | Value |\n'
        report += '|--------|-------|\n'
        otherMetrics.forEach(([k, v]) => {
          report += `| ${k.replace(/_/g, ' ')} | ${formatValue(v)} |\n`
        })
        report += '\n'
      }
    }
    
    // Model Interpretability
    if (xai) {
      report += '## 3. Model Interpretability Analysis\n\n'
      
      if (isRecord(xai) && Array.isArray(xai['permutation_importance']) && (xai['permutation_importance'] as unknown[]).length > 0) {
        report += '### Permutation Importance Analysis\n\n'
        report += 'The following features are ranked by their importance to model predictions:\n\n'
        
        report += '| Rank | Feature | Importance | Std Dev |\n'
        report += '|------|---------|------------|----------|\n'
        ;(xai['permutation_importance'] as unknown[]).slice(0, 10).forEach((raw, idx: number) => {
          if (!isRecord(raw)) return
          const feature = typeof raw['feature'] === 'string' ? (raw['feature'] as string) : 'feature'
          const mean = raw['importance_mean']
          const std = raw['importance_std']
          const stdStr = std !== undefined ? `±${formatValue(std)}` : 'N/A'
          report += `| ${idx + 1} | ${feature} | ${formatValue(mean)} | ${stdStr} |\n`
        })
        report += '\n'
        
        const top = (xai['permutation_importance'] as unknown[])[0]
        if (isRecord(top) && typeof top['feature'] === 'string') {
          report += `**Most Important Feature:** "${top['feature'] as string}" with an importance score of `
          report += `${formatValue(top['importance_mean'])}. This feature has the greatest impact on model predictions.\n\n`
        }
      }
      
      if (
        isRecord(xai) &&
        isRecord(xai['shap_summary']) &&
        Array.isArray((xai['shap_summary'] as Record<string, unknown>)['feature_names']) &&
        ((xai['shap_summary'] as Record<string, unknown>)['feature_names'] as unknown[]).length > 0
      ) {
        report += '### SHAP (SHapley Additive exPlanations) Analysis\n\n'
        report += 'Global feature importance based on SHAP values:\n\n'
        
        const shapSummary = xai['shap_summary'] as Record<string, unknown>
        const names = shapSummary['feature_names'] as string[]
        const vals = (shapSummary['global_mean_abs'] as unknown[] | undefined) ?? []

        const shapPairs = names
          .map((name: string, idx: number) => ({
            name,
            value: Number(vals[idx] ?? 0),
          }))
          .sort((a, b) => b.value - a.value)
        
        report += '| Rank | Feature | SHAP Value |\n'
        report += '|------|---------|------------|\n'
        shapPairs.slice(0, 10).forEach((item, idx: number) => {
          report += `| ${idx + 1} | ${item.name} | ${formatValue(item.value)} |\n`
        })
        report += '\n'
      }
    }
    
    // Robustness and Sensitivity
    if (sensitivity || robustness) {
      report += '## 4. Model Robustness and Sensitivity\n\n'
      
      if (sensitivity) {
        report += '### Sensitivity Analysis\n\n'
        
        if (sensitivity.label_flip_rate !== undefined) {
          report += `**Label Flip Rate:** ${formatValue(sensitivity.label_flip_rate)}\n\n`
          const lfr = Number(sensitivity.label_flip_rate)
          if (lfr > 0.1) {
            report += `⚠️ **WARNING:** High label flip rate (${formatPercent(lfr)}). The model is sensitive to small `
            report += `perturbations in input data. This indicates potential instability.\n\n`
          } else if (lfr > 0.05) {
            report += `⚠️ **CAUTION:** Moderate label flip rate (${formatPercent(lfr)}). The model shows some `
            report += `sensitivity to input perturbations.\n\n`
          } else {
            report += `The model demonstrates good stability with a low label flip rate.\n\n`
          }
        }
        
        if (sensitivity.proba_shift_mean !== undefined) {
          report += `**Probability Shift Mean:** ${formatValue(sensitivity.proba_shift_mean)}\n\n`
          const psm = Math.abs(Number(sensitivity.proba_shift_mean))
          if (psm > 0.1) {
            report += `⚠️ **WARNING:** Significant probability shift detected. Model predictions are highly sensitive `
            report += `to input variations.\n\n`
          } else {
            report += `The model shows acceptable stability in probability estimates.\n\n`
          }
        }
      }
      
      if (robustness) {
        report += '### Robustness Analysis\n\n'
        
        if (robustness.metric_drop !== undefined) {
          report += `**Metric Drop (Noise):** ${formatValue(robustness.metric_drop)}\n\n`
          const md = Number(robustness.metric_drop)
          if (md > 0.15) {
            report += `⚠️ **WARNING:** Significant performance degradation (${formatPercent(md)}) under noise. `
            report += `The model may not generalize well to noisy real-world data.\n\n`
          } else if (md > 0.05) {
            report += `⚠️ **CAUTION:** Moderate performance drop (${formatPercent(md)}) observed. Consider improving `
            report += `model robustness.\n\n`
          } else {
            report += `The model maintains good performance under noise conditions.\n\n`
          }
        }
        
        if (robustness.missing_feature_impact) {
          if (robustness.missing_feature_impact.metric_drop !== undefined) {
            report += `**Missing Feature Impact:** ${formatValue(robustness.missing_feature_impact.metric_drop)}\n\n`
            const mfi = Number(robustness.missing_feature_impact.metric_drop)
            if (mfi > 0.1) {
              report += `⚠️ **WARNING:** High sensitivity to missing features (${formatPercent(mfi)} performance drop). `
              report += `The model may fail in production if required features are unavailable.\n\n`
            } else {
              report += `The model handles missing features reasonably well.\n\n`
            }
          }
          
          if (robustness.missing_feature_impact.top_features) {
            report += `**Most Sensitive Features to Missingness:**\n\n`
            report += '| Rank | Feature |\n'
            report += '|------|---------|\n'
            robustness.missing_feature_impact.top_features.forEach((feat: string, idx: number) => {
              report += `| ${idx + 1} | ${feat} |\n`
            })
            report += '\n'
          }
        }
      }
    }
    
    // Fairness Analysis
    if (fairness) {
      if (fairness.skipped) {
        report += '## 5. Fairness Analysis\n\n'
        report += `Fairness analysis was skipped: ${fairness.reason || 'No sensitive attribute provided'}.\n\n`
      } else {
        report += '## 5. Fairness Analysis\n\n'
        report += 'The following fairness metrics were evaluated to assess potential bias in the model:\n\n'
        
        report += '| Metric | Value | Status |\n'
        report += '|--------|-------|--------|\n'
        
        if (fairness.demographic_parity_diff !== undefined) {
          const dpd = Math.abs(Number(fairness.demographic_parity_diff))
          const status = dpd > 0.1 ? '⚠️ Warning' : '✓ Acceptable'
          report += `| Demographic Parity Difference | ${formatValue(fairness.demographic_parity_diff)} | ${status} |\n`
        }
        
        if (fairness.disparate_impact !== undefined) {
          const di = Number(fairness.disparate_impact)
          const status = (di < 0.8 || di > 1.25) ? '⚠️ Warning' : '✓ Acceptable'
          report += `| Disparate Impact | ${formatValue(fairness.disparate_impact)} | ${status} |\n`
        }
        
        if (fairness.equal_opportunity_diff !== undefined) {
          const eod = Math.abs(Number(fairness.equal_opportunity_diff))
          const status = eod > 0.1 ? '⚠️ Warning' : '✓ Acceptable'
          report += `| Equal Opportunity Difference | ${formatValue(fairness.equal_opportunity_diff)} | ${status} |\n`
        }
        
        if (fairness.predictive_equality_diff !== undefined) {
          const ped = Math.abs(Number(fairness.predictive_equality_diff))
          const status = ped > 0.1 ? '⚠️ Warning' : '✓ Acceptable'
          report += `| Predictive Equality Difference | ${formatValue(fairness.predictive_equality_diff)} | ${status} |\n`
        }
        
        report += '\n'
        
        // Add detailed explanations
        if (fairness.demographic_parity_diff !== undefined) {
          const dpd = Math.abs(Number(fairness.demographic_parity_diff))
          if (dpd > 0.1) {
            report += `⚠️ **WARNING:** Significant demographic parity difference detected (${formatValue(dpd)}). `
            report += `The model shows different positive prediction rates across groups, indicating potential bias.\n\n`
          } else {
            report += `The model demonstrates acceptable demographic parity.\n\n`
          }
        }
        
        if (fairness.disparate_impact !== undefined) {
          const di = Number(fairness.disparate_impact)
          if (di < 0.8 || di > 1.25) {
            report += `⚠️ **WARNING:** Disparate impact ratio outside acceptable range (0.8-1.25). `
            report += `This may indicate discriminatory effects.\n\n`
          } else {
            report += `The disparate impact ratio is within acceptable bounds.\n\n`
          }
        }
        
        if (fairness.equal_opportunity_diff !== undefined) {
          const eod = Math.abs(Number(fairness.equal_opportunity_diff))
          if (eod > 0.1) {
            report += `⚠️ **WARNING:** Significant difference in true positive rates across groups (${formatValue(eod)}). `
            report += `The model may not provide equal opportunities for positive outcomes.\n\n`
          } else {
            report += `The model provides similar true positive rates across groups.\n\n`
          }
        }
        
        if (fairness.predictive_equality_diff !== undefined) {
          const ped = Math.abs(Number(fairness.predictive_equality_diff))
          if (ped > 0.1) {
            report += `⚠️ **WARNING:** Significant difference in false positive rates across groups (${formatValue(ped)}). `
            report += `This may indicate unequal treatment of negative cases.\n\n`
          } else {
            report += `The model shows similar false positive rates across groups.\n\n`
          }
        }
      }
    }
    
    // Risks and Recommendations
    if (diagnose) {
      report += '## 6. Identified Risks and Recommendations\n\n'
      
      if (diagnose.risks && diagnose.risks.length > 0) {
        report += '### Identified Risks\n\n'
        diagnose.risks.forEach((risk: string, idx: number) => {
          report += `${idx + 1}. ${risk}\n\n`
        })
      } else {
        report += '### Identified Risks\n\n'
        report += 'No specific risks were identified during the analysis.\n\n'
      }
      
      if (diagnose.recommendations && diagnose.recommendations.length > 0) {
        report += '### Recommendations for Improvement\n\n'
        diagnose.recommendations.forEach((rec: string, idx: number) => {
          report += `${idx + 1}. ${rec}\n\n`
        })
      } else {
        report += '### Recommendations for Improvement\n\n'
        report += 'No specific recommendations were generated.\n\n'
      }
    }
    
    // Conclusion
    report += '## 7. Conclusion\n\n'
    
    if (diagnose?.summary) {
      report += 'Based on the comprehensive analysis performed, the model has been evaluated across multiple '
      report += 'dimensions including performance, interpretability, robustness, and fairness. '
      report += 'Please refer to the sections above for detailed findings and recommendations.\n\n'
    } else {
      report += 'This audit report provides a comprehensive evaluation of the machine learning model. '
      report += 'All identified issues, risks, and recommendations have been documented above. '
      report += 'It is recommended to address the identified concerns before deploying the model to production.\n\n'
    }
    
    report += '---\n\n'
    report += '*End of Report*\n'
    
    return report
  }, [result, evalRes, xai, sensitivity, robustness, fairness, diagnose])

  const reportMarkdown = useMemo(() => generateReport(), [generateReport])

  if (!result) {
    return <p className="text-[11px] text-[var(--text-muted)]">{reportMarkdown}</p>
  }

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg)]/40 p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
      <div className="prose prose-invert prose-sm max-w-none 
        prose-headings:text-[var(--text)] prose-headings:font-bold
        prose-h1:text-2xl prose-h1:mb-6 prose-h1:mt-0 prose-h1:leading-tight
        prose-h2:text-xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:border-b prose-h2:border-[var(--card-border)] prose-h2:pb-2 prose-h2:leading-tight
        prose-h3:text-lg prose-h3:mb-3 prose-h3:mt-6 prose-h3:leading-tight
        prose-p:text-[var(--text)] prose-p:leading-relaxed prose-p:mb-4 prose-p:text-sm prose-p:whitespace-pre-line
        prose-strong:text-[var(--text)] prose-strong:font-bold
        prose-table:text-sm prose-table:w-full prose-table:my-6
        prose-th:border prose-th:border-[var(--card-border)] prose-th:bg-[var(--bg)]/60 prose-th:p-3 prose-th:text-left prose-th:font-semibold
        prose-td:border prose-td:border-[var(--card-border)] prose-td:p-3 prose-td:text-sm
        prose-ul:text-[var(--text)] prose-ul:my-4 prose-li:mb-2 prose-li:leading-relaxed
        prose-ol:text-[var(--text)] prose-ol:my-4 prose-li:mb-2 prose-li:leading-relaxed
        prose-code:text-[var(--text)] prose-code:bg-[var(--bg)]/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-hr:border-[var(--card-border)] prose-hr:my-8
        prose-blockquote:border-l-4 prose-blockquote:border-[var(--card-border)] prose-blockquote:pl-4 prose-blockquote:my-4
        [&>*+*]:mt-4 [&>h1+*]:mt-6 [&>h2+*]:mt-4 [&>h3+*]:mt-3 [&>p+p]:mt-4 [&>ul+*]:mt-4 [&>ol+*]:mt-4 [&>table+*]:mt-6">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-4 leading-relaxed text-sm">{children}</p>,
            h1: ({ children }) => <h1 className="mb-6 mt-0 text-2xl font-bold leading-tight">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-4 mt-8 border-b border-[var(--card-border)] pb-2 text-xl font-bold leading-tight">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-3 mt-6 text-lg font-bold leading-tight">{children}</h3>,
            table: ({ children }) => <div className="my-6 overflow-x-auto"><table className="w-full text-sm">{children}</table></div>,
            ul: ({ children }) => <ul className="my-4 list-disc list-inside space-y-2">{children}</ul>,
            ol: ({ children }) => <ol className="my-4 list-decimal list-inside space-y-2">{children}</ol>,
            li: ({ children }) => <li className="mb-2 leading-relaxed">{children}</li>,
            hr: () => <hr className="my-8 border-[var(--card-border)]" />,
          }}
        >
          {reportMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  )
}

