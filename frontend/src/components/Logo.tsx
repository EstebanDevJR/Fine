import { Link } from '@tanstack/react-router'
import { useTheme } from './useTheme'

type LogoProps = {
  onClick?: () => void
}

export function Logo({ onClick }: LogoProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const Content = (
    <div className="flex items-center gap-4 group cursor-pointer select-none">
      <div className="relative">
        <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 scale-150 opacity-0 group-hover:opacity-100 ${
          isLight ? 'bg-blue-500/20 group-hover:bg-emerald-400/30' : 'bg-blue-500/15 group-hover:bg-emerald-400/20'
        }`} />
        <div className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl shadow-2xl transition-all duration-500 group-hover:scale-105 ${
          isLight 
            ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 border border-slate-600/30 group-hover:border-slate-600/50' 
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-white/10 group-hover:border-white/20'
        }`}>
          <div className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15),transparent_70%)] ${
            isLight ? 'opacity-30' : 'opacity-50'
          }`} />
          <svg
            viewBox="0 0 24 24"
            className={`w-6 h-6 relative z-10 -skew-x-12 ${
              isLight 
                ? 'drop-shadow-[0_0_8px_rgba(0,0,0,0.2)]' 
                : 'drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
            }`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 21V3H18M7 12H15"
              stroke={isLight ? '#1e293b' : 'white'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-colors duration-500 group-hover:stroke-emerald-500"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col -space-y-1">
        <div className="flex items-center">
          <span className={`font-['Space_Grotesk'] text-2xl font-bold italic tracking-tight transition-colors duration-300 ${
            isLight 
              ? 'text-slate-900 group-hover:text-emerald-600' 
              : 'text-white group-hover:text-emerald-300'
          }`}>
            Fine
          </span>
          <div className="ml-2 flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)] group-hover:animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] group-hover:animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-sans text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${
            isLight 
              ? 'text-slate-600 group-hover:text-emerald-600' 
              : 'text-white/60 group-hover:text-emerald-300'
          }`}>
            Audit
          </span>
          <div className="h-[1px] w-4 bg-gradient-to-r from-emerald-400/60 to-transparent group-hover:w-8 transition-all duration-500" />
        </div>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button onClick={onClick} className="outline-none">
        {Content}
      </button>
    )
  }

  return (
    <Link to="/" className="outline-none">
      {Content}
    </Link>
  )
}
