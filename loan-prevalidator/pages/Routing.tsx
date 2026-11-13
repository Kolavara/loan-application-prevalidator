import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../api'
import { api } from '../api'
import { escapeHtml, formatINR, statusColor, priorityColor } from '../utils'
import { RefreshCw } from 'lucide-react'

export default function Routing() {
  const { data: routing, run: runRouting } = useApi(api.listRouting, true)
  const { data: handlers, run: runHandlers } = useApi(api.listHandlers, true)
  const { data: queue, run: runQueue } = useApi(api.getQueue, true)
  const [zoneFilter, setZoneFilter] = useState('')
  const [processStatus, setProcessStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [processMsg, setProcessMsg] = useState('')

  const rows = useMemo(() => {
    const list = routing || []
    const z = zoneFilter.toLowerCase()
    return z ? list.filter((r) => r.zone.toLowerCase().includes(z)) : list
  }, [routing, zoneFilter])

  const zones = useMemo(() => {
    const set = new Set<string>()
    ;(routing || []).forEach((r) => set.add(r.zone))
    return Array.from(set).sort()
  }, [routing])

  const handlerList = handlers || []
  const centralHandlers = handlerList.filter((h) => h.zone === 'Central')
  const otherHandlers = handlerList.filter((h) => h.zone !== 'Central')

  const waiting = queue?.waiting || []
  const correction = queue?.correction || []
  const escalations = queue?.escalations || []
  const overrides = queue?.overrides || []

  const handleProcess = async () => {
    setProcessStatus('idle')
    setProcessMsg('')
    const res = await api.processQueue()
    if (res.ok) {
      setProcessStatus('ok')
      setProcessMsg(`Processed ${res.data?.processed ?? 0} waiting report(s)`)
      runQueue()
      runRouting()
    } else {
      setProcessStatus('error')
      setProcessMsg(res.error?.message || 'Processing failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-8">
        <div>
          <h2 className="mb-1">Routing desk</h2>
          <p className="small">Routing table, handler load, queues and override decisions.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="btn btn-sm btn-primary"
            disabled={processStatus === 'idle' || waiting.length === 0 || processStatus === 'pending'}
            onClick={handleProcess}
          >
            {processStatus === 'pending' ? 'Processing…' : 'Process waiting queue'}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => { runRouting(); runHandlers(); runQueue() }}>Refresh</button>
        </div>
      </div>
      {processStatus !== 'idle' && processStatus !== 'pending' && (
        <p className={`text-xs ${processStatus === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--status-rejected)]'}`}>
          {escapeHtml(processMsg)}
        </p>
      )}

      {/* Routing table */}
      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Routing table</h3>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold">Zone</label>
            <select className="w-auto" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
              <option value="">All zones</option>
              {zones.map((z) => <option key={z} value={z}>{escapeHtml(z)}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Category</th>
                <th>Band</th>
                <th>Branch</th>
                <th>Team</th>
                <th>Depot</th>
                <th className="text-center">Authority</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-[var(--muted-fg)]">No routing rows match the filter.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.zone}|${row.category}|${row.band}`}>
                    <td>{escapeHtml(row.zone)}</td>
                    <td>{escapeHtml(row.category)}</td>
                    <td className="mono">{escapeHtml(row.band)}</td>
                    <td>{escapeHtml(row.branch)}</td>
                    <td>{escapeHtml(row.team)}</td>
                    <td>{escapeHtml(row.depot)}</td>
                    <td className="text-center">{escapeHtml(row.authority)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Handler load */}
      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Handler load</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Handler</th>
                <th className="text-center">Zone</th>
                <th className="text-center">Category</th>
                <th className="text-center">Role</th>
                <th className="text-center">Load</th>
                <th className="text-center">Capacity</th>
                <th className="text-center">Available</th>
                <th className="text-center">Flag</th>
              </tr>
            </thead>
            <tbody>
              {handlerList.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--muted-fg)]">No handlers.</td></tr>
              ) : (
                handlerList.map((h) => {
                  const isCentral = h.zone === 'Central'
                  const overloaded = h.load >= h.capacity
                  const flag = isCentral ? 'Escalation (Central)' : overloaded ? 'At capacity' : '—'
                  return (
                    <tr key={h.id} className={isCentral ? 'critical-row' : ''}>
                      <td>{escapeHtml(h.name)}</td>
                      <td className="text-center">{escapeHtml(h.zone)}</td>
                      <td className="text-center">{escapeHtml(h.category)}</td>
                      <td className="text-center">{escapeHtml(h.role)}</td>
                      <td className="text-center mono">{h.load}</td>
                      <td className="text-center mono">{h.capacity}</td>
                      <td className="text-center">{h.available ? 'Yes' : 'No'}</td>
                      <td className="text-center small">{flag}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          <div className="mt-3 text-[12px] text-[var(--muted-fg)]">
            Central-zone handlers are marked as escalation points. Backups are non-Central handlers in the same category with available capacity.
          </div>
        </div>
      </section>

      {/* Queues */}
      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Queues</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[13px] mb-2">Waiting queue ({waiting.length})</h4>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th className="id-cell" style={{ width: 90 }}>Report ID</th>
                    <th className="id-cell" style={{ width: 110 }}>Application code</th>
                    <th>Reporter</th>
                    <th className="text-center">Zone</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-[var(--muted-fg)]">Empty.</td></tr>
                  ) : (
                    waiting.map((rep) => (
                      <tr key={rep.report_id}>
                        <td className="id-cell mono small">{escapeHtml(rep.report_id)}</td>
                        <td className="id-cell mono small">{escapeHtml(rep.application_code)}</td>
                        <td className="small">{escapeHtml(rep.reporter_name)}</td>
                        <td className="text-center small">{escapeHtml(rep.zone || '—')}</td>
                        <td className="text-center small">{escapeHtml(rep.category || '—')}</td>
                        <td className="text-center small priority-bar {priorityColor(rep.urgency)}">{escapeHtml(String(rep.priority_rank || '—'))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="text-[13px] mb-2">Correction queue ({correction.length})</h4>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th className="id-cell" style={{ width: 90 }}>Report ID</th>
                    <th className="id-cell" style={{ width: 110 }}>Application code</th>
                    <th>Reporter</th>
                    <th className="text-center">Zone</th>
                    <th className="text-center">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {correction.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-[var(--muted-fg)]">Empty.</td></tr>
                  ) : (
                    correction.map((rep) => (
                      <tr key={rep.report_id}>
                        <td className="id-cell mono small">{escapeHtml(rep.report_id)}</td>
                        <td className="id-cell mono small">{escapeHtml(rep.application_code)}</td>
                        <td className="small">{escapeHtml(rep.reporter_name)}</td>
                        <td className="text-center small">{escapeHtml(rep.zone || '—')}</td>
                        <td className="text-center small">{escapeHtml(rep.validation_msg || 'Rejected')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Escalations & overrides */}
      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Escalation &amp; override decisions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[13px] mb-2">Escalations ({escalations.length})</h4>
            <div className="space-y-2">
              {escalations.length === 0 ? (
                <p className="text-[12px] text-[var(--muted-fg)]">None.</p>
              ) : (
                escalations.map((rep) => (
                  <div key={rep.report_id} className="border border-solid border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <span className="mono text-xs">{escapeHtml(rep.report_id)}</span>
                      <span className={`tag ${statusColor(rep.status)}`} style={{ fontSize: '10px' }}>{escapeHtml(rep.status)}</span>
                    </div>
                    <div className="text-[12px] text-[var(--muted-fg)]">{escapeHtml(rep.reporter_name || '')} · {escapeHtml(rep.application_code || '')}</div>
                    <div className="text-[12px] mt-1">{escapeHtml(rep.routing_reason || 'Escalated — handler at capacity')}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <h4 className="text-[13px] mb-2">Priority overrides ({overrides.length})</h4>
            <div className="space-y-2">
              {overrides.length === 0 ? (
                <p className="text-[12px] text-[var(--muted-fg)]">None.</p>
              ) : (
                overrides.map((rep) => (
                  <div key={rep.report_id} className="border border-solid border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <span className="mono text-xs">{escapeHtml(rep.report_id)}</span>
                      <span className={`tag critical`} style={{ fontSize: '10px' }}>Critical</span>
                    </div>
                    <div className="text-[12px] text-[var(--muted-fg)]">{escapeHtml(rep.reporter_name || '')} · {escapeHtml(rep.application_code || '')}</div>
                    <div className="text-[12px] mt-1">Priority {escapeHtml(String(rep.priority_rank || '—'))}</div>
                    <div className="text-[12px] mt-1">{escapeHtml(rep.routing_reason || 'Priority override applied')}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
