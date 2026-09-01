import { useEffect } from 'react'

/**
 * One requestAnimationFrame loop for every rain canvas on the page, throttled
 * to ~18fps. The low framerate is the intended look and keeps a grid of tiles
 * cheap. The loop stops entirely when nothing is subscribed or the tab hides.
 */
const TICK_MS = 55

type Subscriber = (deltaMs: number) => void

const subscribers = new Set<Subscriber>()
let frame: number | null = null
let lastTime = 0
let accumulator = 0

function loop(time: number) {
  frame = requestAnimationFrame(loop)
  const delta = lastTime === 0 ? 0 : time - lastTime
  lastTime = time
  accumulator += delta
  if (accumulator < TICK_MS) return
  const step = accumulator
  accumulator = 0
  subscribers.forEach((subscriber) => subscriber(step))
}

function start() {
  if (frame !== null || typeof window === 'undefined') return
  lastTime = 0
  accumulator = 0
  frame = requestAnimationFrame(loop)
}

function stop() {
  if (frame === null) return
  cancelAnimationFrame(frame)
  frame = null
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else if (subscribers.size > 0) start()
  })
}

export function useMatrixTicker(callback: Subscriber, active: boolean): void {
  useEffect(() => {
    if (!active) return
    subscribers.add(callback)
    start()
    return () => {
      subscribers.delete(callback)
      if (subscribers.size === 0) stop()
    }
  }, [callback, active])
}
