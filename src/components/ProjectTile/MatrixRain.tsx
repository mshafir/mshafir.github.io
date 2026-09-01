import { useCallback, useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { useMatrixTicker } from './useMatrixTicker'

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789<>/{}[]=;:$#@&*'
const CELL = 14
const REST_COLOR = '#2A3340'
const ACTIVE_COLOR = '#22D3EE'

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

export function MatrixRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropsRef = useRef<number[]>([])
  const activeRef = useRef(active)
  const visibleRef = useRef(false)
  const reducedMotion = usePrefersReducedMotion()

  activeRef.current = active

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    const columns = Math.max(1, Math.floor(rect.width / CELL))
    dropsRef.current = Array.from({ length: columns }, () =>
      Math.floor((Math.random() * rect.height) / CELL),
    )
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // A translucent wipe rather than a clear, so trailing glyphs fade out.
    context.fillStyle = 'rgba(11, 14, 19, 0.16)'
    context.fillRect(0, 0, width, height)
    context.font = `${CELL - 2}px ui-monospace, monospace`
    context.fillStyle = activeRef.current ? ACTIVE_COLOR : REST_COLOR

    const drops = dropsRef.current
    const speed = activeRef.current ? 1 : 0.45

    for (let i = 0; i < drops.length; i++) {
      context.fillText(randomGlyph(), i * CELL, drops[i] * CELL)
      drops[i] += speed
      if (drops[i] * CELL > height && Math.random() > 0.975) drops[i] = 0
    }
  }, [])

  const tick = useCallback(() => {
    if (visibleRef.current) paint()
  }, [paint])

  useMatrixTicker(tick, !reducedMotion)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resize()

    // A static field for reduced motion: the texture without the movement.
    if (reducedMotion) {
      paint()
      paint()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
      },
      { rootMargin: '80px' },
    )
    observer.observe(canvas)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [resize, paint, reducedMotion])

  return <canvas ref={canvasRef} className="tile__rain" aria-hidden="true" />
}
