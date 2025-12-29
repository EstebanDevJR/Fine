import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { MessageCircle, X, Sparkles, Send, Bot, User, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../api/useAuth'
import type { Analysis } from '../api/schemas'

const QUICK_PROMPTS = [
  'Give me an executive summary of this analysis',
  'What are the main risks?',
  'Recommend remediation next steps',
  'Were there fairness findings?',
]

export function AnalysisChatWidget() {
  const { user, loading } = useAuth()
  const router = useRouterState()
  const [open, setOpen] = useState(false)
  const [analysisId, setAnalysisId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])

  const listQuery = useQuery<Analysis[]>({
    queryKey: ['analyses'],
    queryFn: api.listAnalyses,
    enabled: Boolean(user) && open,
  })

  const activeAnalysisId = analysisId ?? listQuery.data?.[0]?.id ?? null

  const analysisLabel = useMemo(() => {
    if (!listQuery.data) return ''
    const found = listQuery.data.find((a) => a.id === activeAnalysisId)
    if (!found) return ''
    return `Analysis #${found.id} · DS ${found.dataset_id} · Model ${found.model_id}`
  }, [activeAnalysisId, listQuery.data])

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!activeAnalysisId) throw new Error('Selecciona un análisis')
      return api.analysisQA({
        analysis_id: activeAnalysisId,
        question,
        page: router.location.pathname,
        page_context: 'Floating chat widget',
      }) as Promise<{ answer: string }>
    },
    onSuccess: (res) => {
      setMessages((msgs) => [...msgs, { role: 'assistant', content: res.answer }])
    },
  })

  const handleSend = (text?: string) => {
    const q = (text ?? input).trim()
    if (!q) return
    setMessages((msgs) => [...msgs, { role: 'user', content: q }])
    setInput('')
    chatMutation.mutate(q)
  }

  if (!user || loading) return null

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--text)] text-[var(--bg)] shadow-2xl w-14 h-14 flex items-center justify-center hover:scale-105 transition-transform"
        title="AI chat about analyses"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-full max-w-md glass-card border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)] bg-[var(--bg)]/60">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text)]">AI Assistant</p>
            </div>
            <select
              value={activeAnalysisId ?? ''}
              onChange={(e) => setAnalysisId(e.target.value ? Number(e.target.value) : null)}
              className="text-[11px] rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/60 px-3 py-1 text-[var(--text)] outline-none"
            >
              <option value="">Select analysis</option>
              {(listQuery.data || []).map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id} · DS {a.dataset_id} · M {a.model_id} · {a.status}
                </option>
              ))}
            </select>
          </div>

          <div className="px-4 py-3 space-y-3 max-h-72 overflow-auto custom-scrollbar">
            {analysisLabel && <p className="text-[10px] text-[var(--text-muted)]">{analysisLabel}</p>}

            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="text-[10px] px-3 py-1.5 rounded-xl border border-[var(--card-border)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>

            {messages.length === 0 && (
              <div className="text-[11px] text-[var(--text-muted)]">
                Ask about metrics, risks, or fairness. Use quick prompts to start.
              </div>
            )}

            <div className="space-y-2">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border flex gap-2 ${
                    m.role === 'user'
                      ? 'border-[var(--card-border)] bg-[var(--bg)]/40'
                      : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-4 h-4 text-[var(--text-muted)]" /> : <Bot className="w-4 h-4" />}
                  <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pensando...
                </div>
              )}
              {chatMutation.error && (
                <p className="text-[11px] text-rose-500">Error: {(chatMutation.error as Error).message}</p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-t border-[var(--card-border)] bg-[var(--bg)]/60 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask the AI about your analyses..."
              className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--bg)]/50 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!activeAnalysisId || chatMutation.isPending}
              className="px-4 py-2 rounded-xl bg-[var(--text)] text-[var(--bg)] text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}

