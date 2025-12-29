import { useState, type FormEvent } from 'react'
import type React from 'react'
import { Mail, MapPin } from 'lucide-react'
import { MagneticButton } from '../MagneticButton'
import { useReveal } from '../useReveal'

export function ContactSection() {
  const { ref, isVisible } = useReveal(0.3)
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) return
    setIsSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setIsSubmitting(false)
    setSubmitSuccess(true)
    setFormData({ name: '', email: '', message: '' })
    setTimeout(() => setSubmitSuccess(false), 4000)
  }

  return (
    <section
      ref={ref}
      className="flex h-screen w-screen shrink-0 snap-start items-center px-4 pt-20 md:px-12 md:pt-0 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl space-y-10 md:space-y-14">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12 lg:gap-16">
          <div className="flex flex-col justify-center space-y-6">
            <div
              className={`inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur transition-all duration-700 ${
                isVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">Contact</span>
            </div>
            <div
              className={`transition-all duration-700 ${
                isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
              }`}
            >
              <h2 className="mb-2 text-4xl font-light leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
                Let's talk
              </h2>
              <p className="font-mono text-xs text-white/60 md:text-base">/ Get in touch</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoBlock
                icon={<Mail className="h-4 w-4 text-white/70" />}
                label="Email"
                value="hello@fine-audit.local"
                isVisible={isVisible}
                delay={200}
              />
              <InfoBlock
                icon={<MapPin className="h-4 w-4 text-white/70" />}
                label="Location"
                value="Remote-first"
                isVisible={isVisible}
                delay={320}
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <form
              onSubmit={handleSubmit}
              className="space-y-4 md:space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur anim-softfloat"
            >
              <LabeledInput
                label="Name"
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
                delay="150ms"
                isVisible={isVisible}
              />
              <LabeledInput
                label="Email"
                type="email"
                value={formData.email}
                onChange={(v) => setFormData({ ...formData, email: v })}
                delay="260ms"
                isVisible={isVisible}
              />
              <LabeledTextarea
                label="Message"
                value={formData.message}
                onChange={(v) => setFormData({ ...formData, message: v })}
                delay="380ms"
                isVisible={isVisible}
              />

              <div
                className={`transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
                style={{ transitionDelay: '520ms' }}
              >
                <MagneticButton variant="primary" size="lg" className="w-full disabled:opacity-50">
                  {isSubmitting ? 'Sending...' : 'Send message'}
                </MagneticButton>
                {submitSuccess && (
                  <p className="mt-3 text-center font-mono text-sm text-white/80">Message sent successfully!</p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoBlock({
  icon,
  label,
  value,
  delay,
  isVisible,
}: {
  icon: React.ReactNode
  label: string
  value: string
  delay: number
  isVisible: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-all duration-700 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="mb-2 flex items-center gap-2 text-white/70">
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="text-white text-sm md:text-base">{value}</p>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  delay,
  isVisible,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  delay: string
  isVisible: boolean
  type?: string
}) {
  return (
    <div
      className={`transition-all duration-700 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0'}`}
      style={{ transitionDelay: delay }}
    >
      <label className="mb-1 block font-mono text-xs text-white/60 md:mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full border-b border-white/30 bg-transparent py-1.5 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none md:py-2 md:text-base"
        placeholder={label}
      />
    </div>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  delay,
  isVisible,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  delay: string
  isVisible: boolean
}) {
  return (
    <div
      className={`transition-all duration-700 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0'}`}
      style={{ transitionDelay: delay }}
    >
      <label className="mb-1 block font-mono text-xs text-white/60 md:mb-2">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full border-b border-white/30 bg-transparent py-1.5 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none md:py-2 md:text-base"
        placeholder="Tell us about your audit..."
      />
    </div>
  )
}

