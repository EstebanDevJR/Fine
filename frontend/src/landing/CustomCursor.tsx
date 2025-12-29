import { useEffect, useRef } from 'react'

export function CustomCursor() {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const isPointerRef = useRef(false)

  useEffect(() => {
    let raf: number

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const update = () => {
      positionRef.current.x = lerp(positionRef.current.x, targetRef.current.x, 0.15)
      positionRef.current.y = lerp(positionRef.current.y, targetRef.current.y, 0.15)

      if (outerRef.current && innerRef.current) {
        const scale = isPointerRef.current ? 1.5 : 1
        const innerScale = isPointerRef.current ? 0.5 : 1
        outerRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) translate(-50%, -50%) scale(${scale})`
        innerRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0) translate(-50%, -50%) scale(${innerScale})`
      }

      raf = requestAnimationFrame(update)
    }

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
      const target = e.target as HTMLElement
      isPointerRef.current =
        window.getComputedStyle(target).cursor === 'pointer' || target.tagName === 'BUTTON' || target.tagName === 'A'
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div
        ref={outerRef}
        className="pointer-events-none fixed left-0 top-0 z-50 mix-blend-difference will-change-transform"
        style={{ contain: 'layout style paint' }}
      >
        <div className="h-4 w-4 rounded-full border-2 border-white" />
      </div>
      <div
        ref={innerRef}
        className="pointer-events-none fixed left-0 top-0 z-50 mix-blend-difference will-change-transform"
        style={{ contain: 'layout style paint' }}
      >
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    </>
  )
}

