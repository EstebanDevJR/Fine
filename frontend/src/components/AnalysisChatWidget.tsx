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
      if (!activeAnalysisId) throw new Error('Select an analysis')
      // Send conversation history (current messages state, which doesn't include the new question yet)
      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
      return api.analysisQA({
        analysis_id: activeAnalysisId,
        question,
        page: router.location.pathname,
        page_context: 'Floating chat widget',
        conversation_history: history.length > 0 ? history : undefined,
      }) as Promise<{ answer: string }>
    },
    onSuccess: (res) => {
      setMessages((msgs) => [...msgs, { role: 'assistant', content: res.answer }])
    },
  })

  const handleSend = (text?: string) => {
    const q = (text ?? input).trim()
    if (!q) return
    // Add user message to state first (optimistic update)
    setMessages((msgs) => [...msgs, { role: 'user', content: q }])
    setInput('')
    // Then send to API (history will be the previous messages, not including this new one)
    chatMutation.mutate(q)
  }

  if (!user || loading) return null

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--text)] text-[var(--bg)] shadow-2xl shadow-[var(--text)]/30 w-14 h-14 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 min-w-[56px] min-h-[56px] ripple"
        title="AI chat about analyses"
        aria-label="Toggle AI chat"
        aria-expanded={open}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-full max-w-md glass-card border-2 border-[var(--card-border)] rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--card-border)] bg-[var(--bg)]/70 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text)]">AI Assistant</p>
            </div>
            <select
              value={activeAnalysisId ?? ''}
              onChange={(e) => setAnalysisId(e.target.value ? Number(e.target.value) : null)}
              className="text-[11px] rounded-xl border-2 border-[var(--card-border)] bg-[var(--bg)]/60 px-3 py-1.5 text-[var(--text)] outline-none focus:border-emerald-500/50 transition-all"
              aria-label="Select analysis"
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
                  Thinking...
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
              className="flex-1 rounded-xl border-2 border-[var(--card-border)] bg-[var(--bg)]/50 px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-emerald-500/70 focus:bg-[var(--bg)]/70 focus:shadow-md focus:shadow-emerald-500/20 transition-all placeholder:text-[var(--muted)] placeholder:opacity-50"
              aria-label="Chat input"
            />
            <button
              onClick={() => handleSend()}
              disabled={!activeAnalysisId || chatMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] text-[10px] font-black uppercase tracking-[0.15em] hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] transition-all shadow-md"
              aria-label="Send message"
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

