export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
  category?: string
  class_note?: string
  band?: string
  zone_used?: string
  zone_fallback?: string
}

export type Urgency = 'low' | 'normal' | 'high' | 'critical'
export type Category = 'Home' | 'Vehicle' | 'Personal' | 'Education' | 'Invalid'

export interface Report {
  report_id: string
  application_code: string
  income: number | string
  amount: number | string
  reporter_name: string
  contact: string
  description: string
  urgency: Urgency
  zone: string
  zone_used?: string
  category: Category
  band?: string
  status: string
  queue?: string
  handler_name?: string
  branch?: string
  team?: string
  depot?: string
  routing_reason?: string
  priority_rank?: number
  escalated?: boolean
  validation_msg?: string
  created_at?: string
}

export interface ReportsList {
  reports: Report[]
  counts: {
    total: number
    Pending: number
    Assigned: number
    'In Progress': number
    Resolved: number
  }
}

export interface ReportDetail {
  report: Report
  history: Array<{ ts: string; event: string }>
}

export interface Handler {
  id: string | number
  name: string
  category: string
  zone: string
  role: string
  authority: string
  capacity: number
  load: number
  available: boolean
}

export interface RoutingRow {
  zone: string
  category: string
  band: string
  branch: string
  team: string
  depot: string
  authority: string
}

export interface QueueData {
  waiting: Report[]
  correction: Report[]
  escalations: Report[]
  overrides: Report[]
}

export interface Analytics {
  total: number
  by_zone: Array<{ label: string; n: number }>
  by_category: Record<string, number>
  by_status: Record<string, number>
  by_priority: Record<string, number>
  resolved: number
  unresolved: number
  waiting: number
  correction: number
  escalated: number
}

export interface FormFields {
  reporter_name: string
  contact: string
  application_code: string
  income: string
  amount: string
  zone: string
  urgency: Urgency
  description: string
}

export interface ApiError {
  status?: number
  message: string
  errors?: Record<string, string>
  existing_report_id?: string
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: ApiError
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResult<unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    clearTimeout(timer)
    const ct = res.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await res.json() : await res.text()
    if (!res.ok) {
      return {
        ok: false,
        error: {
          status: res.status,
          message: (body as any)?.message || res.statusText,
          errors: (body as any)?.errors,
          existing_report_id: (body as any)?.existing_report_id,
        },
      }
    }
    return { ok: true, data: body }
  } catch (e) {
    clearTimeout(timer)
    return { ok: false, error: { message: e instanceof Error ? e.message : 'Request failed' } }
  }
}

function post(path: string, body: unknown) {
  return fetchJson(path, { method: 'POST', body: JSON.stringify(body) })
}

function patch(path: string, body: unknown) {
  return fetchJson(path, { method: 'PATCH', body: JSON.stringify(body) })
}

function get(path: string) {
  return fetchJson(path, { method: 'GET' })
}

export const api = {
  validate: (fields: Partial<FormFields>) => post('/api/validate', fields) as Promise<ApiResult<ValidationResult>>,
  submitReport: (fields: FormFields) => post('/api/reports', fields) as Promise<ApiResult<{ report_id: string; status: string; queue?: string; handler_name?: string; routing_reason?: string; category?: string; priority_rank?: number }>>,
  correctReport: (id: string, fields: FormFields) => post(`/api/reports/${id}/correct`, fields) as Promise<ApiResult<{ report_id: string; status: string; queue?: string; handler_name?: string; routing_reason?: string }>>,
  listReports: (q?: string, status?: string, category?: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    return get(`/api/reports?${params}`) as Promise<ApiResult<ReportsList>>
  },
  getReport: (id: string) => get(`/api/reports/${id}`) as Promise<ApiResult<ReportDetail>>,
  patchReportStatus: (id: string, status: string) => patch(`/api/reports/${id}/status`, { status }) as Promise<ApiResult<Report>>,
  listHandlers: () => get('/api/handlers') as Promise<ApiResult<Handler[]>>,
  patchHandler: (id: string | number, body: { available?: boolean; capacity?: number }) =>
    patch(`/api/handlers/${id}`, body) as Promise<ApiResult<Handler>>,
  getHandlerReports: (id: string | number) => get(`/api/handlers/${id}/reports`) as Promise<ApiResult<Report[]>>,
  listRouting: () => get('/api/routing') as Promise<ApiResult<RoutingRow[]>>,
  getQueue: () => get('/api/queue') as Promise<ApiResult<QueueData>>,
  processQueue: () => post('/api/queue/process', {}) as Promise<ApiResult<{ processed: number }>>,
  getAnalytics: () => get('/api/analytics') as Promise<ApiResult<Analytics>>,
  demoSeed: () => post('/api/demo-seed', {}) as Promise<ApiResult<{ seeded: number }>>,
}

import { useCallback, useEffect, useState } from 'react'

export function useApi<T>(fn: (...args: any[]) => Promise<ApiResult<T>>, auto = false) {
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({
    data: null,
    error: null,
    loading: auto,
  })
  const run = useCallback(async (...args: any[]): Promise<ApiResult<T>> => {
    setState({ data: null, error: null, loading: true })
    const result = await fn(...args)
    setState({ data: (result.data as T | null) ?? null, error: result.error ?? null, loading: false })
    return result
  }, [fn])
  useEffect(() => {
    if (!auto) return
    let mounted = true
    const tick = () => {
      run().then(() => {
        if (mounted) setState((s) => ({ ...s, loading: false }))
      })
    }
    tick()
    const timer = setInterval(tick, 10000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [run, auto])
  return { ...state, run }
}
