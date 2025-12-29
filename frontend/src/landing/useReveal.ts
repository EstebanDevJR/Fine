import { useEffect, useRef, useState } from 'react'

export function useReveal(threshold = 0.3) {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Find the scroll container (element with data-scroll-container attribute)
    let scrollContainer: HTMLElement | null = null
    let parent: HTMLElement | null = node.parentElement
    while (parent) {
      if (parent.hasAttribute('data-scroll-container')) {
        scrollContainer = parent
        break
      }
      parent = parent.parentElement
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { 
        threshold, 
        root: scrollContainer, // Use the scroll container as root instead of viewport
        rootMargin: scrollContainer ? '-20% 0px -20% 0px' : '0px', // Trigger when section is 20% visible from edges
      },
    )

    observer.observe(node)

    return () => {
      observer.unobserve(node)
    }
  }, [threshold])

  return { ref, isVisible }
}

