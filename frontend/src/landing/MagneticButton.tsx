import { useRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'default' | 'lg'

interface MagneticButtonProps {
  children: React.ReactNode
  className?: string
  variant?: Variant
  size?: Size
  onClick?: () => void
  disabled?: boolean
}

export function MagneticButton({
  children,
  className = '',
  variant = 'primary',
  size = 'default',
  onClick,
  disabled,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | undefined>(undefined)

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    posRef.current = { x: x * 0.15, y: y * 0.15 }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`
    })
  }

  const onLeave = () => {
    posRef.current = { x: 0, y: 0 }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.transform = 'translate3d(0px, 0px, 0)'
    })
  }

  const variants: Record<Variant, string> = {
    primary:
      'bg-foreground/90 text-background hover:bg-foreground shadow-lg shadow-foreground/20 backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]',
    secondary:
      'bg-white/5 text-white hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-white/20',
    ghost: 'bg-transparent text-white hover:bg-white/5 backdrop-blur-sm border border-transparent hover:border-white/10',
  }

  const sizes: Record<Size, string> = {
    default: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  }

  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative overflow-hidden rounded-full font-medium transition-all duration-300 ease-out will-change-transform ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ transform: 'translate3d(0px,0px,0)', contain: 'layout style paint' }}
    >
      <span className="relative z-10">{children}</span>
    </button>
  )
}

