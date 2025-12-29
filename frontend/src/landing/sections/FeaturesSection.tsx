import { useReveal } from '../useReveal'

const FEATURES = [
  { title: 'Ingestion & storage', description: 'Upload datasets/models with checksums, local artifacts, SQLite metadata.', direction: 'top' },
  { title: 'Observability', description: 'Request IDs, in-memory + Prometheus metrics, readiness probes, rate limit.', direction: 'right' },
  { title: 'Explainability', description: 'Permutation importance and SHAP for global insights with sampling controls.', direction: 'left' },
  { title: 'Reporting', description: 'HTML/PDF via Jinja2 + WeasyPrint with artifacts, diagnosis, and recommendations.', direction: 'bottom' },
]

export function FeaturesSection() {
  const { ref, isVisible } = useReveal(0.3)

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-6 pt-20 md:px-12 md:pt-0 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-10 md:space-y-14">
        <div
          className={`flex flex-col gap-3 transition-all duration-700 ${
            isVisible ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'
          }`}
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-white/5 px-4 py-2 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">Capabilities</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-4xl font-light tracking-tight text-white md:text-5xl lg:text-6xl">Capabilities</h2>
              <p className="font-mono text-sm text-white/60 md:text-base">/ What the audit system delivers</p>
            </div>
            <div className="flex gap-2 text-[11px] uppercase tracking-[0.16em] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">XAI</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Stress</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Fairness</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reporting</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  feature,
  index,
  isVisible,
}: {
  feature: { title: string; description: string; direction: string }
  index: number
  isVisible: boolean
}) {
  const hiddenByDir: Record<string, string> = {
    left: '-translate-x-16 opacity-0',
    right: 'translate-x-16 opacity-0',
    top: '-translate-y-16 opacity-0',
    bottom: 'translate-y-16 opacity-0',
  }
  const reveal = isVisible ? 'translate-x-0 translate-y-0 opacity-100' : hiddenByDir[feature.direction] ?? 'translate-y-12 opacity-0'

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all duration-700 hover:border-white/25 hover:shadow-[0_20px_60px_-35px_rgba(0,0,0,0.6)] anim-softfloat ${reveal}`}
      style={{ transitionDelay: `${index * 120}ms`, animationDelay: `${index * 0.25}s` }}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-5 bg-gradient-to-br from-emerald-400/60 via-purple-500/60 to-transparent" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-center font-mono text-xs leading-8 text-white/70">
            0{index + 1}
          </span>
          <h3 className="text-lg font-semibold text-white md:text-xl">{feature.title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/60">
          {feature.direction}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-white/80 md:text-base">{feature.description}</p>
    </div>
  )
}

