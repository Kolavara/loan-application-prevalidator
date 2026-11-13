export function escapeHtml(text: string | null | undefined): string {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

export function formatINR(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatAmount(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

export function statusColor(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'pending') return 'pending'
  if (s === 'assigned') return 'assigned'
  if (s === 'in progress' || s === 'in_progress') return 'inprogress'
  if (s === 'resolved') return 'resolved'
  if (s === 'rejected' || s === 'correction') return 'rejected'
  return 'pending'
}

export function priorityColor(p: string | undefined): string {
  const s = (p || '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'normal') return 'normal'
  return 'low'
}

export function truncate(text: string, n: number): string {
  if (!text) return ''
  return text.length > n ? text.slice(0, n - 1).trim() + '…' : text
}

export const ZONES = ['North', 'South', 'East', 'West', 'Central']

export const URGENCIES: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export const CODE_PREFIX = 'LOAN'
const CODE_REGEX = /^LOAN([HVPE])\d{6}$/

export function validateCode(code: string): { ok: boolean; category?: string; error?: string } {
  const m = CODE_REGEX.test(code) ? code.match(/^LOAN([HVPE])(\d{6})$/) : null
  if (!m) return { ok: false, error: 'Use LOAN + H/V/P/E + 6 digits (e.g. LOANH123456)' }
  const catMap: Record<string, string> = { H: 'Home', V: 'Vehicle', P: 'Personal', E: 'Education' }
  return { ok: true, category: catMap[m[1]] }
}
