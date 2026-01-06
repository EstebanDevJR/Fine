import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Shader, ChromaFlow, Swirl } from 'shaders/react'
import { MagneticButton } from '../landing/MagneticButton'
import { PipelineSection } from '../landing/sections/PipelineSection'
import { FeaturesSection } from '../landing/sections/FeaturesSection'
import { AboutSection } from '../landing/sections/AboutSection'
import { ContactSection } from '../landing/sections/ContactSection'
import { GrainOverlay } from '../landing/GrainOverlay'
import { useAuth } from '../api/useAuth'
import { Logo } from '../components/Logo.tsx'

function HeroSection({
  onScrollPipeline,
  onStart,
}: {
  onScrollPipeline: () => void
  onStart: () => void
}) {
  return (
    <section className="flex min-h-screen w-screen shrink-0 snap-start flex-col justify-end px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24 md:px-12 md:pb-24">
      <div className="max-w-5xl text-white space-y-7">
        <div className="inline-flex items-center gap-3 rounded-full border border-purple-400/30 bg-emerald-500/10 px-3 py-1 backdrop-blur-md sm:px-4 sm:py-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]" />
          <p className="font-mono text-[10px] text-emerald-200 sm:text-xs tracking-[0.2em] uppercase">End-to-end AI audit</p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl drop-shadow-lg">
            Audit, explain, and harden your ML models.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg md:text-xl font-medium">
            Ingest models and datasets, evaluate metrics, run XAI, stress and fairness checks, then get an LLM-driven
            diagnosis and executive-ready reports. Fully automated—just watch the progress.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <MagneticButton size="lg" variant="primary" onClick={onScrollPipeline} className="text-sm sm:text-base shadow-xl shadow-emerald-500/20">
            View pipeline
          </MagneticButton>
          <MagneticButton size="lg" variant="secondary" onClick={onStart} className="text-sm sm:text-base shadow-lg">
            Start audit
          </MagneticButton>
        </div>

        <div className="grid gap-5 pt-4 sm:grid-cols-3">
          {[
            { title: 'Automated', desc: 'Full pipeline, no manual steps.' },
            { title: 'Explainable', desc: 'XAI + fairness insights.' },
            { title: 'Observable', desc: 'Traced with Langfuse.' },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border-2 border-white/15 bg-white/8 p-5 backdrop-blur-xl hover:border-white/25 hover:bg-white/12 transition-all duration-200 hover:-translate-y-1 shadow-lg">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/90 mb-2">{item.title}</p>
              <p className="text-sm text-white/90 font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection({ onStart, onScrollPipeline }: { onStart: () => void; onScrollPipeline: () => void }) {
  const steps = [
    { title: 'Upload', desc: 'Datasets & models' },
    { title: 'Run', desc: 'Metrics → XAI → stress → fairness → diagnose with LangGraph + Celery.' },
    { title: 'Report', desc: 'LLM summary' },
  ]
  return (
    <section className="flex h-screen w-screen shrink-0 snap-start items-center px-4 pt-16 md:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-6xl space-y-10 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">How it works</p>
            <h2 className="text-4xl font-light tracking-tight md:text-5xl">From upload to report</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Supabase Auth</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">S3 storage</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">LangGraph</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Langfuse</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur anim-softfloat"
              style={{ animationDelay: `${i * 0.25}s` }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-center font-mono text-xs leading-8 text-white/70">
                  0{i + 1}
                </span>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">{step.title}</p>
              </div>
              <p className="text-sm text-white/85">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MagneticButton size="lg" variant="primary" onClick={onStart}>
            Start audit
          </MagneticButton>
          <MagneticButton size="lg" variant="secondary" onClick={onScrollPipeline}>
            See pipeline details
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}

function TrustSection() {
  return (
    <section className="flex h-screen w-screen shrink-0 snap-start items-center px-4 pt-16 md:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-6xl space-y-10 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Trust & Observability</p>
            <h2 className="text-4xl font-light tracking-tight md:text-5xl">Built for secure, traceable runs</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/70">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">JWT validated</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">RLS ready</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Traces in Langfuse</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur anim-softfloat-slow">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60 mb-3">Live signals</p>
            <div className="flex flex-wrap gap-2 text-sm text-white/85">
              {[
                'Supabase Auth session → bearer injection',
                'S3 presign PUT/GET for datasets/models/reports',
                'Celery workers online for async audit',
                'LangGraph nodes traced in Langfuse',
              ].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-5 backdrop-blur anim-breath">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60 mb-2">Micro demo</p>
            <div className="flex items-center justify-between">
              <div className="max-w-xs text-sm text-white/85">
                Slot for a 15s clip: upload → status → report download. Replace with your hosted mp4/webm.
              </div>
              <div className="ml-4 h-20 w-32 rounded-xl border border-white/15 bg-gradient-to-br from-purple-500/20 via-emerald-400/15 to-transparent blur-[0.3px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)
  const scrollThrottleRef = useRef<number | undefined>(undefined)
  const scrollInProgressRef = useRef<boolean>(false)
  const pendingScrollRef = useRef<number | null>(null)
  const sectionLabels = ['Home', 'How', 'Pipeline', 'Capabilities', 'Trust', 'About', 'Contact'] as const

  useEffect(() => {
    const checkShaderReady = () => {
      if (shaderContainerRef.current) {
        const canvas = shaderContainerRef.current.querySelector('canvas')
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          setIsLoaded(true)
          return true
        }
      }
      return false
    }

    if (checkShaderReady()) return

    const intervalId = setInterval(() => {
      if (checkShaderReady()) {
        clearInterval(intervalId)
      }
    }, 100)

    const fallbackTimer = setTimeout(() => {
      setIsLoaded(true)
    }, 1500)

    return () => {
      clearInterval(intervalId)
      clearTimeout(fallbackTimer)
    }
  }, [])

  // Handle window resize to maintain correct scroll position
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      // Debounce resize to avoid too many calculations
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const container = scrollContainerRef.current
        if (!container) return
        
        // Get actual section width (wait a bit for layout to settle)
        setTimeout(() => {
          const firstSection = container.querySelector('section') as HTMLElement
          if (!firstSection) return
          
          const sectionWidth = firstSection.offsetWidth
          
          // Recalculate and adjust scroll position based on current section
          const targetScroll = sectionWidth * currentSection
          
          // Only adjust if there's a significant difference (more than 10px)
          if (Math.abs(container.scrollLeft - targetScroll) > 10) {
            container.scrollTo({ left: targetScroll, behavior: 'auto' })
          }
        }, 100)
      }, 150)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [currentSection])

  // Block vertical scroll on body/document
  useEffect(() => {
    const preventVerticalScroll = (e: WheelEvent) => {
      // Only prevent if it's primarily vertical scrolling
      // Don't interfere with horizontal scroll or if it's on the scroll container
      const target = e.target as HTMLElement
      const scrollContainer = scrollContainerRef.current
      
      // If the event is on or inside the scroll container, let the container handle it
      if (scrollContainer && (target === scrollContainer || scrollContainer.contains(target))) {
        return
      }
      
      // Otherwise, prevent vertical scroll
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const preventTouchVerticalScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const scrollContainer = scrollContainerRef.current
      
      // If the event is on or inside the scroll container, let the container handle it
      if (scrollContainer && (target === scrollContainer || scrollContainer.contains(target))) {
        return
      }
      
      // Prevent vertical touch scrolling outside the container
      e.preventDefault()
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.height = '100vh'
    document.documentElement.style.height = '100vh'

    // Add wheel listener to document to catch all scroll events outside container
    document.addEventListener('wheel', preventVerticalScroll, { passive: false })
    document.addEventListener('touchmove', preventTouchVerticalScroll, { passive: false })

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.style.height = ''
      document.documentElement.style.height = ''
      document.removeEventListener('wheel', preventVerticalScroll)
      document.removeEventListener('touchmove', preventTouchVerticalScroll)
    }
  }, [])

  const goToUploadOrAuth = () => {
    navigate({ to: session ? '/upload' : '/auth' })
  }

  const scrollToSection = useCallback((index: number, cancelPrevious = true) => {
    const container = scrollContainerRef.current
    if (!container) return
    
    const maxIndex = sectionLabels.length - 1
    const clampedIndex = Math.max(0, Math.min(maxIndex, index))
    
    // If already scrolling to the same section, ignore
    if (scrollInProgressRef.current && pendingScrollRef.current === clampedIndex) {
      return
    }
    
    // Cancel any ongoing scroll if requested
    if (cancelPrevious && scrollInProgressRef.current) {
      // Stop the current scroll animation by jumping to current position
      container.scrollTo({ left: container.scrollLeft, behavior: 'auto' })
    }
    
    // Get all sections to calculate exact positions
    const sections = container.querySelectorAll('section')
    if (sections.length === 0) return
    
    // Get the first section's width (all sections should have same width: w-screen)
    const firstSection = sections[0] as HTMLElement
    const sectionWidth = firstSection.offsetWidth
    
    // Calculate target scroll position - exact pixel position at the start of the section
    const targetScroll = sectionWidth * clampedIndex
    
    // Mark scroll as in progress
    scrollInProgressRef.current = true
    pendingScrollRef.current = clampedIndex
    
    // Temporarily disable scroll snap for programmatic scroll to avoid conflicts
    const originalSnapType = container.style.scrollSnapType
    container.style.scrollSnapType = 'none'
    
    // Update state immediately for UI feedback
    setCurrentSection(clampedIndex)
    
    // Use smooth scroll with longer duration for smoother transition
    container.scrollTo({ 
      left: targetScroll, 
      behavior: 'smooth' 
    })
    
    // Re-enable scroll snap after scroll animation completes and verify position
    const scrollDuration = 800 // Increased duration for smoother transition
    setTimeout(() => {
      // Ensure we're at the exact position (in case of rounding issues)
      const currentScroll = container.scrollLeft
      const expectedScroll = sectionWidth * clampedIndex
      const difference = Math.abs(currentScroll - expectedScroll)
      
      // If we're off by more than 2px, correct it smoothly
      if (difference > 2) {
        container.scrollTo({ left: expectedScroll, behavior: 'smooth' })
      }
      
      // Re-enable scroll snap
      container.style.scrollSnapType = originalSnapType || ''
      
      // Mark scroll as complete
      scrollInProgressRef.current = false
      pendingScrollRef.current = null
    }, scrollDuration)
  }, [sectionLabels.length])

  // Keyboard navigation (left/right arrows) for horizontal sections
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') scrollToSection(currentSection + 1)
      if (e.key === 'ArrowLeft') scrollToSection(currentSection - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentSection, scrollToSection])

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      touchStartX.current = e.touches[0].clientX
    }
    const handleTouchMove = (e: TouchEvent) => {
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
      // Prevent vertical scroll, allow horizontal
      if (dy > dx && dy > 10) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      const dy = touchStartY.current - e.changedTouches[0].clientY
      const dx = touchStartX.current - e.changedTouches[0].clientX
      // Convert vertical swipe to horizontal section navigation
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 50) {
        e.preventDefault()
        if (dy > 0 && currentSection < 4) scrollToSection(currentSection + 1)
        else if (dy < 0 && currentSection > 0) scrollToSection(currentSection - 1)
      }
    }
    const c = scrollContainerRef.current
    if (c) {
      c.addEventListener('touchstart', handleTouchStart, { passive: true })
      c.addEventListener('touchmove', handleTouchMove, { passive: false })
      c.addEventListener('touchend', handleTouchEnd, { passive: false })
    }
    return () => {
      if (c) {
        c.removeEventListener('touchstart', handleTouchStart)
        c.removeEventListener('touchmove', handleTouchMove)
        c.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [currentSection, scrollToSection])

  useEffect(() => {
    let lastWheelTime = 0
    let wheelTimeout: NodeJS.Timeout
    let accumulatedDelta = 0
    const WHEEL_THROTTLE = 50 // ms between wheel events to consider as separate scrolls
    const DELTA_THRESHOLD = 50 // Minimum accumulated delta to trigger scroll
    
    const handleWheel = (e: WheelEvent) => {
      // Always prevent vertical scroll and convert to horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        e.stopPropagation()
        
        const now = Date.now()
        const timeSinceLastWheel = now - lastWheelTime
        
        // If scroll is in progress, only allow if enough time has passed
        if (scrollInProgressRef.current && timeSinceLastWheel < 300) {
          return
        }
        
        const c = scrollContainerRef.current
        if (!c) return
        
        // Accumulate delta for rapid scrolls
        accumulatedDelta += Math.abs(e.deltaY)
        lastWheelTime = now
        
        // Clear existing timeout
        clearTimeout(wheelTimeout)
        
        // Wait a bit to see if more wheel events come (for rapid scrolling)
        wheelTimeout = setTimeout(() => {
          // Only proceed if we have enough accumulated delta
          if (accumulatedDelta < DELTA_THRESHOLD) {
            accumulatedDelta = 0
            return
          }
          
          // Get actual section width
          const firstSection = c.querySelector('section') as HTMLElement
          const sectionWidth = firstSection?.offsetWidth || window.innerWidth
          const currentScroll = c.scrollLeft
          
          // Determine scroll direction based on accumulated delta
          const scrollDirection = e.deltaY > 0 ? 1 : -1
          
          // Calculate current section index using same logic as handleScroll
          const rawIndex = currentScroll / sectionWidth
          const threshold = 0.3
          let currentIndex: number
          
          if (rawIndex % 1 > threshold) {
            currentIndex = Math.ceil(rawIndex)
          } else {
            currentIndex = Math.floor(rawIndex)
          }
          
          // For rapid scrolls, allow jumping multiple sections
          const rapidScrollMultiplier = accumulatedDelta > 200 ? Math.min(Math.floor(accumulatedDelta / 200), 2) : 1
          let targetIndex = currentIndex + scrollDirection * rapidScrollMultiplier
          
          // Clamp to valid range
          const maxIndex = sectionLabels.length - 1
          targetIndex = Math.max(0, Math.min(maxIndex, targetIndex))
          
          // Only scroll if we're moving to a different section
          if (targetIndex !== currentIndex && targetIndex >= 0 && targetIndex <= maxIndex) {
            scrollToSection(targetIndex, true)
          }
          
          // Reset accumulated delta
          accumulatedDelta = 0
        }, WHEEL_THROTTLE)
      } else if (Math.abs(e.deltaX) > 0) {
        // Allow horizontal scroll but prevent default to avoid conflicts
        e.preventDefault()
        e.stopPropagation()
        const c = scrollContainerRef.current
        if (c) {
          c.scrollBy({ left: e.deltaX, behavior: 'smooth' })
        }
      }
    }
    const c = scrollContainerRef.current
    if (c) {
      c.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      if (c) c.removeEventListener('wheel', handleWheel)
      clearTimeout(wheelTimeout)
    }
  }, [scrollToSection, sectionLabels.length])

  useEffect(() => {
    const handleScroll = () => {
      if (scrollThrottleRef.current) return
      scrollThrottleRef.current = requestAnimationFrame(() => {
        const c = scrollContainerRef.current
        if (!c) {
          scrollThrottleRef.current = undefined
          return
        }
        // Get actual section width
        const firstSection = c.querySelector('section') as HTMLElement
        const sectionWidth = firstSection?.offsetWidth || window.innerWidth
        const scrollLeft = c.scrollLeft
        
        // Calculate which section is most visible
        // Use floor to determine which section we're in based on scroll position
        // Add a threshold to avoid flickering (only change if we're more than 30% into next section)
        const rawIndex = scrollLeft / sectionWidth
        const threshold = 0.3 // 30% threshold
        let newIndex: number
        
        if (rawIndex % 1 > threshold) {
          // More than 30% into the next section, round up
          newIndex = Math.ceil(rawIndex)
        } else {
          // Less than 30% into next section, round down
          newIndex = Math.floor(rawIndex)
        }
        
        const maxIndex = sectionLabels.length - 1
        const clampedIndex = Math.max(0, Math.min(maxIndex, newIndex))
        
        if (clampedIndex !== currentSection) {
          setCurrentSection(clampedIndex)
        }
        scrollThrottleRef.current = undefined
      })
    }
    const c = scrollContainerRef.current
    if (c) c.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      if (c) c.removeEventListener('scroll', handleScroll)
      if (scrollThrottleRef.current) cancelAnimationFrame(scrollThrottleRef.current)
    }
  }, [currentSection, sectionLabels.length])

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#0A0F1E]" style={{ overscrollBehavior: 'none' }}>
      <GrainOverlay />

      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ contain: 'strict' }}
      >
        <Shader className="h-full w-full">
          <Swirl
            colorA="#6D28D9" // Purple AI
            colorB="#10B981" // Emerald verification
            speed={0.8}
            detail={0.8}
            blend={50}
            coarseX={40}
            coarseY={40}
            mediumX={40}
            mediumY={40}
            fineX={40}
            fineY={40}
          />
          <ChromaFlow
            baseColor="#0A0F1E" // Deep base
            upColor="#6D28D9"
            downColor="#10B981"
            leftColor="#10B981"
            rightColor="#6D28D9"
            intensity={0.95}
            radius={1.8}
            momentum={25}
            maskType="alpha"
            opacity={0.97}
          />
        </Shader>
        <div className="absolute inset-0 bg-[#0A0F1E]/35" />
      </div>

      <nav
        className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 transition-opacity duration-700 sm:px-6 md:px-12 md:py-6 backdrop-blur-2xl bg-black/20 border-b border-white/10 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button onClick={() => scrollToSection(0)} className="transition-transform hover:scale-105">
          <Logo />
        </button>

        <div className="hidden items-center gap-4 text-white sm:gap-6 md:gap-8 lg:flex">
          {sectionLabels.map((item, index) => (
            <button
              key={item}
              onClick={() => scrollToSection(index)}
              className={`group relative font-sans text-xs font-medium transition-colors sm:text-sm ${
                currentSection === index ? 'text-white' : 'text-white/90 hover:text-white'
              }`}
            >
              {item}
              <span
                className={`absolute -bottom-1 left-0 h-px bg-cyan-400 transition-all duration-300 ${
                  currentSection === index ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
          ))}
        </div>

        <MagneticButton variant="secondary" onClick={goToUploadOrAuth} className="text-xs sm:text-sm">
          <span className="hidden sm:inline">Start audit</span>
          <span className="sm:hidden">Start</span>
        </MagneticButton>
      </nav>

      <div
        ref={scrollContainerRef}
        data-scroll-container
        className={`relative z-10 flex h-screen overflow-x-auto overflow-y-hidden transition-opacity duration-700 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none',
          scrollPadding: '0',
        }}
      >
        {[
          <HeroSection
            key="home"
            onScrollPipeline={() => scrollToSection(2)}
            onStart={goToUploadOrAuth}
          />,
          <HowItWorksSection key="how" onStart={goToUploadOrAuth} onScrollPipeline={() => scrollToSection(2)} />,
          <PipelineSection key="pipeline" />,
          <FeaturesSection key="capabilities" />,
          <TrustSection key="trust" />,
          <AboutSection key="about" scrollToSection={scrollToSection} />,
          <ContactSection key="contact" />,
        ]}
      </div>

      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
        
        [data-scroll-container] {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
        
        [data-scroll-container] section {
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }
      `}</style>
    </main>
  )
}

