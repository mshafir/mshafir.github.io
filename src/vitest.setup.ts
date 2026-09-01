import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; stub it so components that check
// prefers-reduced-motion and the desktop breakpoint render deterministically.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom has no IntersectionObserver; the rain canvases construct one on mount.
if (!window.IntersectionObserver) {
  class StubObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  window.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver
}
