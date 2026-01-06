import { useRef } from 'react'
import { useTheme } from '../components/useTheme'

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
  const { theme } = useTheme()
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
      'bg-foreground/90 text-background hover:bg-foreground shadow-lg shadow-foreground/20 backdrop-blur-md hover:scale-[1.05] active:scale-[0.98] transition-all duration-200',
    secondary:
      theme === 'light'
        ? 'bg-slate-800/90 text-white hover:bg-slate-800 backdrop-blur-xl border-2 border-slate-700/50 hover:border-slate-700 hover:scale-[1.05] active:scale-[0.98] transition-all duration-200'
        : 'bg-white/5 text-white hover:bg-white/10 backdrop-blur-xl border-2 border-white/10 hover:border-white/30 hover:scale-[1.05] active:scale-[0.98] transition-all duration-200',
    ghost: 'bg-transparent text-white hover:bg-white/5 backdrop-blur-sm border-2 border-transparent hover:border-white/20 hover:scale-[1.05] active:scale-[0.98] transition-all duration-200',
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
      className={`relative overflow-hidden rounded-full font-medium transition-all duration-200 ease-out will-change-transform ripple min-h-[44px] min-w-[44px] ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ transform: 'translate3d(0px,0px,0)', contain: 'layout style paint' }}
      aria-disabled={disabled}
    >
      <span className="relative z-10">{children}</span>
    </button>
  )
}

