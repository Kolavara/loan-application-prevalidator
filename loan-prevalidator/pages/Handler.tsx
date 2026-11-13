import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../api'
import { api } from '../api'
import { escapeHtml, formatINR, statusColor, priorityColor } from '../utils'

export default function Handler() {
  const { data: handlers, run: runHandlers, loading: hLoading } = useApi(api.listHandlers, true)
  const [handlerId, setHandlerId] = useState<string | number | null>(null)
  const [selHandler, setSelHandler] = useState<any>(null)
  const { data: handlerReports, run: runHandlerReports } = useApi(api.getHandlerReports, false)
  const [avail, setAvail] = useState<boolean | null>(null)
  const [capacity, setCapacity] = useState('')
  const [capError, setCapError] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [updateMsg, setUpdateMsg] = useState('')

  useEffect(() => {
    if (!handlers || handlers.length === 0) {
      setSelHandler(null)
      return
    }
    const h = handlers.find((x) => String(x.id) === String(handlerId)) || handlers[0]
    setSelHandler(h)
    setHandlerId(h.id)
    setAvail(h.available)
    setCapacity(String(h.capacity || ''))
    if (h.id != null) {
      runHandlerReports(h.id)
    }
  }, [handlers, handlerId, runHandlerReports])

  const handleAvailability = async () => {
    if (selHandler?.id == null) return
    const res = await api.patchHandler(selHandler.id, { available: !selHandler.available })
    if (res.ok) {
      setSelHandler(res.data)
      runHandlers()
    } else {
      setUpdateStatus('error')
      setUpdateMsg(res.error?.message || 'Failed to update availability')
    }
  }

  const handleCapacity = async (e: React.FormEvent) => {
    e.preventDefault()
    setCapError('')
    const n = Number(capacity)
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      setCapError('Capacity must be an integer between 0 and 50')
      return
    }
    if (selHandler?.id == null) return
    const res = await api.patchHandler(selHandler.id, { capacity: n })
    if (res.ok) {
      setSelHandler(res.data)
      setUpdateStatus('ok')
      setUpdateMsg('Capacity updated')
      runHandlers()
    } else {
      setUpdateStatus('error')
      setUpdateMsg(res.error?.message || 'Failed to update capacity')
    }
  }

  const handleStatus = async (status: string, report: any) => {
    const res = await api.patchReportStatus(report.report_id, status)
    if (res.ok) {
      runHandlerReports(selHandler?.id ?? 0)
    } else {
      setUpdateStatus('error')
      setUpdateMsg(res.error?.message || `Could not ${status}`)
    }
  }

  const handlerList = handlers || []
  const reports = handlerReports || []
  const loadPct = selHandler ? Math.round((selHandler.load / Math.max(selHandler.capacity, 1)) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-8">
        <div>
          <h2 className="mb-1">Handler desk</h2>
          <p className="small">Assigned reports, status changes, availability and capacity.</p>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => runHandlers()}>Refresh</button>
      </div>

      {/* Handler selector */}
      <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Handler</label>
          <select
            className="w-full"
            value={handlerId ?? ''}
            onChange={(e) => setHandlerId(e.target.value || null)}
            disabled={hLoading}
          >
            <option value="">Select a handler</option>
            {handlerList.map((h) => (
              <option key={h.id} value={h.id}>
                {escapeHtml(h.name)} ({escapeHtml(h.category)})
              </option>
            ))}
          </select>
          {hLoading && <p className="small text-[var(--muted-fg)] mt-1">Loading…</p>}
        </div>
        <div className="md:col-span-2">
          <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Selected handler</p>
          {selHandler ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="mono text-lg font-bold">{escapeHtml(selHandler.name)}</span>
                <span className={`tag ${statusColor(selHandler.available ? 'assigned' : 'pending')}`}>{selHandler.available ? 'Available' : 'Unavailable'}</span>
              </div>
              <p className="text-[12px] text-[var(--muted-fg)]">{escapeHtml(selHandler.category)} · {escapeHtml(selHandler.zone)} · {escapeHtml(selHandler.role)} · {escapeHtml(selHandler.authority)}</p>
              <div className="mt-2 text-[12px]">
                Load <span className="mono">{selHandler.load}</span> / Capacity <span className="mono">{selHandler.capacity}</span>
                ({loadPct}%)
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--muted-fg)]">Select a handler from the list.</p>
          )}
        </div>
      </div>

      {/* Availability + capacity controls */}
      {selHandler && (
        <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <button
              className="btn btn-ghost w-full text-left"
              onClick={handleAvailability}
            >
              {selHandler.available ? 'Mark unavailable' : 'Mark available'}
            </button>
          </div>
          <div>
            <form onSubmit={handleCapacity}>
              <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Capacity (0–50)</label>
              <input
                className={`w-full ${capError ? 'invalid' : ''}`}
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="0"
                max="50"
              />
              {capError && <span className="field-error">{escapeHtml(capError)}</span>}
              <button type="submit" className="btn btn-sm btn-primary mt-2 w-full">Set capacity</button>
            </form>
          </div>
          <div className="flex items-end gap-2">
            {updateStatus !== 'idle' && (
              <span className={`text-xs ${updateStatus === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--status-rejected)]'`} font-semibold}>
                {updateMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Assigned reports table */}
      <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-baseline justify-between gap-8 mb-4">
          <div>
            <h3 className="section-title mb-1">Assigned reports</h3>
            <p className="text-xs text-[var(--muted-fg)]">{reports.length} report(s) assigned to {escapeHtml(selHandler?.name || '—')}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="id-cell">Report ID</th>
                <th className="id-cell">Application code</th>
                <th>Reporter</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Zone</th>
                <th className="text-center">Category</th>
                <th className="text-center">Priority</th>
                <th className="text-center">Band</th>
                <th className="text-center">Status</th>
                <th className="text-center">Submitted</th>
                <th style={{ width: 110 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[var(--muted-fg)]">
                    No assigned reports for this handler.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => {
                  const crit = (rep.priority_rank || 0) >= 4 || rep.urgency === 'critical'
                  const canStart = rep.status === 'Pending'
                  const canResolve = rep.status === 'Assigned' || rep.status === 'In Progress'
                  return (
                    <tr
                      key={rep.report_id}
                      className={`hover:bg-[#f2ede2] transition-colors ${crit ? 'critical-row' : ''}`}
                    >
                      <td className="id-cell mono">{escapeHtml(rep.report_id)}</td>
                      <td className="id-cell mono">{escapeHtml(rep.application_code)}</td>
                      <td>{escapeHtml(rep.reporter_name)}</td>
                      <td className="money">{formatINR(rep.amount)}</td>
                      <td className="text-center">{escapeHtml(rep.zone || '—')}</td>
                      <td className="text-center">{escapeHtml(rep.category || '—')}</td>
                      <td className="text-center priority-bar {priorityColor(rep.urgency)}">{escapeHtml(String(rep.priority_rank || '—'))}</td>
                      <td className="text-center">{escapeHtml(rep.band || '—')}</td>
                      <td className="text-center"><span className={`tag ${statusColor(rep.status)}`}>{escapeHtml(rep.status)}</span></td>
                      <td className="text-center small">{escapeHtml(String(rep.created_at || '').slice(0, 16))}</td>
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          {canStart && (
                            <button
                              className="btn btn-xs"
                              onClick={() => handleStatus('In Progress', rep)}
                              disabled={updateStatus !== 'idle'}
                            >
                              Start
                            </button>
                          )}
                          {canResolve && (
                            <button
                              className="btn btn-xs btn-ghost"
                              onClick={() => handleStatus('Resolved', rep)}
                              disabled={updateStatus !== 'idle'}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {updateStatus !== 'idle' && updateMsg && (
        <p className={`text-xs ${updateStatus === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--status-rejected)]'}`}>{escapeHtml(updateMsg)}</p>
      )}
    </div>
  )
}
