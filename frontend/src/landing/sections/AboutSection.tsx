import { MagneticButton } from '../MagneticButton'
import { useReveal } from '../useReveal'

export function AboutSection({ scrollToSection }: { scrollToSection?: (index: number) => void }) {
  const { ref, isVisible } = useReveal(0.3)

  const stats = [
    { value: '9', label: 'Audit phases', sublabel: 'metrics → report', direction: 'right' },
    { value: '5', label: 'Libraries', sublabel: 'SHAP · AIF360 · XGBoost · Torch · SKL', direction: 'left' },
    { value: '24/7', label: 'Workers', sublabel: 'Celery + Redis background jobs', direction: 'right' },
  ]

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-4 pt-20 md:px-12 md:pt-0 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-10 md:space-y-14">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12 lg:gap-16">
          <div className="space-y-6">
            <div
              className={`inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">About</span>
            </div>
            <div
              className={`transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
              }`}
            >
              <h2 className="text-4xl font-light leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
                Built for reliable audits.
              </h2>
            </div>
            <div
              className={`space-y-4 transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
            >
              <p className="max-w-2xl text-sm leading-relaxed text-white/85 md:text-lg">
                From ingestion to LLM diagnosis, every step is automated and reproducible. No more scattered scripts or
                manual notebooks — just a single pipeline.
              </p>
              <p className="max-w-2xl text-sm leading-relaxed text-white/85 md:text-lg">
                Run locally with Bun/Vite + FastAPI, ship in Docker, and keep artifacts versioned in the filesystem.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur transition-all duration-700 anim-softfloat ${
                  isVisible
                    ? 'translate-y-0 opacity-100'
                    : stat.direction === 'left'
                      ? '-translate-x-10 opacity-0'
                      : 'translate-x-10 opacity-0'
                }`}
                style={{ transitionDelay: `${200 + i * 120}ms`, animationDelay: `${i * 0.25}s` }}
              >
                <div className="text-3xl font-semibold text-white md:text-5xl">{stat.value}</div>
                <div className="text-base font-light text-white md:text-lg">{stat.label}</div>
                <div className="font-mono text-xs text-white/60">{stat.sublabel}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`flex flex-wrap gap-3 transition-all duration-700 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <MagneticButton size="lg" variant="primary" onClick={() => scrollToSection?.(4)}>
            Start a run
          </MagneticButton>
          <MagneticButton size="lg" variant="secondary" onClick={() => scrollToSection?.(1)}>
            View pipeline
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}

