export function formatDay(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`)
  if (Number.isNaN(date.getTime())) return isoDay
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function relativeTime(ms: number, now = Date.now()): string {
  const minutes = Math.round((now - ms) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
