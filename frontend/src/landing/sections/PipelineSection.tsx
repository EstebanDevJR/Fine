import { useReveal } from '../useReveal'

const ITEMS = [
  { number: '01', title: 'Evaluation metrics', category: 'Accuracy · F1 · ROC-AUC · RMSE', year: 'Live' },
  { number: '02', title: 'Explainability', category: 'SHAP · Permutation importance', year: 'Live' },
  { number: '03', title: 'Robustness & stress', category: 'Noise · masking · sensitivity', year: 'Live' },
  { number: '04', title: 'Fairness', category: 'Demographic parity · disparate impact', year: 'Live' },
  { number: '05', title: 'LLM diagnosis', category: 'GPT-4o mini reasoning on artifacts', year: 'Live' },
]

export function PipelineSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-6 pt-20 md:px-12 md:pt-0 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-10 md:space-y-14">
        <div
          className={`flex flex-col gap-3 transition-all duration-700 ${
            isVisible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
          }`}
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-purple-400/30 bg-white/5 px-4 py-2 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">Audit pipeline</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-light tracking-tight text-white md:text-5xl lg:text-6xl">Pipeline</h2>
              <p className="font-mono text-sm text-white/60 md:text-base">/ End-to-end model audit stages</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 backdrop-blur md:flex">
              Fully automated flow · metrics → XAI → robustness → fairness → report
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-8">
          {ITEMS.map((item, i) => (
            <div
              key={item.number}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur transition-all duration-700 hover:border-white/25 hover:shadow-[0_20px_60px_-35px_rgba(0,0,0,0.6)] anim-softfloat ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: `${i * 100}ms`, animationDelay: `${i * 0.3}s` }}
            >
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-5 bg-gradient-to-br from-purple-500/60 via-emerald-400/50 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 font-mono text-xs text-white/70">
                    {item.number}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-white md:text-2xl">{item.title}</h3>
                    <p className="font-mono text-[11px] text-white/60 md:text-xs">{item.category}</p>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                  {item.year}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

