import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../api'
import { api } from '../api'
import { escapeHtml, formatINR, statusColor, priorityColor } from '../utils'
import { RefreshCw, ChevronRight } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: reportsData, run: runList } = useApi(api.listReports, true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [correctionResult, setCorrectionResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const [correctionMsg, setCorrectionMsg] = useState('')

  const reports = useMemo(() => {
    const list = reportsData?.reports || []
    const ql = q.toLowerCase()
    return list.filter((r) => {
      const matchQ =
        !ql ||
        String(r.report_id || '').toLowerCase().includes(ql) ||
        String(r.application_code || '').toLowerCase().includes(ql) ||
        String(r.reporter_name || '').toLowerCase().includes(ql)
      const matchStatus = !statusFilter || r.status === statusFilter
      const matchCategory = !categoryFilter || r.category === categoryFilter
      return matchQ && matchStatus && matchCategory
    })
  }, [reportsData, q, statusFilter, categoryFilter])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    api.getReport(detailId).then((res) => {
      setDetail(res.ok ? res.data : null)
      setDetailLoading(false)
    })
  }, [detailId])

  const handleCorrect = async (report: any) => {
    setCorrecting(report.report_id)
    setCorrectionResult('idle')
    setCorrectionMsg('')
    try {
      const res = await api.correctReport(report.report_id, {
        reporter_name: report.reporter_name || '',
        contact: report.contact || '',
        application_code: report.application_code || '',
        income: String(report.income ?? ''),
        amount: String(report.amount ?? ''),
        zone: report.zone || '',
        urgency: report.urgency || 'normal',
        description: report.description || '',
      })
      if (res.ok) {
        setCorrectionResult('ok')
        setCorrectionMsg(`Resubmitted ${escapeHtml(String(res.data?.report_id || report.report_id))} — ${escapeHtml(res.data?.status || '')}`)
        runList()
        setDetail((d) => (d ? { ...d, report: { ...d.report, status: res.data?.status, queue: res.data?.queue } } : d))
      } else {
        setCorrectionResult('error')
        setCorrectionMsg(res.error?.message || 'Resubmission failed')
      }
    } catch (err) {
      setCorrectionResult('error')
      setCorrectionMsg(err instanceof Error ? err.message : 'Resubmission failed')
    } finally {
      setCorrecting(null)
    }
  }

  const counts = reportsData?.counts || { total: 0, Pending: 0, Assigned: 0, 'In Progress': 0, Resolved: 0 }

  const statusOptions = ['Pending', 'Assigned', 'In Progress', 'Resolved']
  const categoryOptions = ['Home', 'Vehicle', 'Personal', 'Education', 'Invalid']

  const r = detail?.report

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-8">
        <div>
          <h2 className="mb-1">Dashboard</h2>
          <p className="small">All reports. Click a row to open the detail panel.</p>
        </div>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => { runList(); setQ(''); setStatusFilter(''); setCategoryFilter(''); setDetailId(null) }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ['Total', counts.total, ''],
          ['Pending', counts.Pending, 'pending'],
          ['Assigned', counts.Assigned, 'assigned'],
          ['In Progress', counts['In Progress'], 'inprogress'],
          ['Resolved', counts.Resolved, 'resolved'],
        ].map(([label, value, tag]) => (
          <div key={label} className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
              <span className="mono text-[20px] font-bold">{value}</span>
              {tag && <span className={`tag ${tag}`}>{label}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-3">
          <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Search by report ID, code or name</label>
          <input
            className="w-full"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. RPT-101 or LOANH123456 or Aarav"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Status</label>
          <select className="w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold block mb-1">Category</label>
          <select className="w-full" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
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
              <th className="text-center">Status</th>
              <th className="text-center">Queue</th>
              <th className="text-center">Handler</th>
              <th className="text-center">Created</th>
              <th style={{ width: 56 }}></th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-12 text-[var(--muted-fg)]">
                  No reports match your filters.{' '}
                  {q || statusFilter || categoryFilter ? 'Clear filters or load demo data.' : 'Load demo data to see sample reports.'}
                </td>
              </tr>
            ) : (
              reports.map((rep) => {
                const crit = (rep.priority_rank || 0) >= 4 || rep.urgency === 'critical'
                return (
                  <tr
                    key={rep.report_id}
                    className={`cursor-pointer hover:bg-[#f2ede2] transition-colors ${crit ? 'critical-row' : ''}`}
                    onClick={() => setDetailId(rep.report_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setDetailId(rep.report_id)}
                  >
                    <td className="id-cell mono">{escapeHtml(rep.report_id)}</td>
                    <td className="id-cell mono">{escapeHtml(rep.application_code)}</td>
                    <td>{escapeHtml(rep.reporter_name)}</td>
                    <td className="money">{formatINR(rep.amount)}</td>
                    <td className="text-center">{escapeHtml(rep.zone || '—')}</td>
                    <td className="text-center">{escapeHtml(rep.category || '—')}</td>
                    <td className="text-center priority-bar {priorityColor(rep.urgency)}">{escapeHtml(String(rep.priority_rank || '—'))}</td>
                    <td className="text-center"><span className={`tag ${statusColor(rep.status)}`}>{escapeHtml(rep.status)}</span></td>
                    <td className="text-center">{escapeHtml(rep.queue || '—')}</td>
                    <td className="text-center">{escapeHtml(rep.handler_name || '—')}</td>
                    <td className="text-center small">{escapeHtml(String(rep.created_at || '').slice(0, 16))}</td>
                    <td className="text-center">
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={(e) => { e.stopPropagation(); setDetailId(rep.report_id) }}
                        aria-label={`Open ${escapeHtml(rep.report_id)}`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Correction result */}
      {correctionResult !== 'idle' && (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title" style={{ color: correctionResult === 'ok' ? 'var(--ok)' : 'var(--status-rejected)' }}>
              {correctionResult === 'ok' ? 'Resubmitted' : 'Resubmission failed'}
            </h3>
          </div>
          <div className="slip" style={{ borderColor: correctionResult === 'ok' ? 'var(--ok)' : 'var(--status-rejected)' }}>
            <div className="slip-row"><span className="slip-label">Result</span><span>{escapeHtml(correctionMsg)}</span></div>
          </div>
        </section>
      )}

      {/* Detail panel */}
      {detailId && (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title">Report detail</h3>
            <button className="btn btn-xs btn-ghost" onClick={() => setDetailId(null)}>Close</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-2">
              {r ? (
                <table className="w-full" style={{ border: 'none' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 0, width: 150 }} className="text-[var(--muted-fg)] text-xs uppercase">Report ID</td>
                      <td style={{ border: 'none', paddingTop: 0 }} className="mono">{escapeHtml(r.report_id)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Application code</td>
                      <td style={{ border: 'none', paddingTop: 6 }} className="mono">{escapeHtml(r.application_code)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Reporter</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.reporter_name)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Contact</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.contact)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Amount</td>
                      <td style={{ border: 'none', paddingTop: 6 }} className="money">{formatINR(r.amount)}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Zone</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.zone || '—')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Category</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.category || '—')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Status</td>
                      <td style={{ border: 'none', paddingTop: 6 }}><span className={`tag ${statusColor(r.status)}`}>{escapeHtml(r.status)}</span></td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Handler</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.handler_name || '—')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Branch · Team · Depot</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{[r.branch, r.team, r.depot].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Routing reason</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.routing_reason || '—')}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', paddingTop: 6 }} className="text-[var(--muted-fg)] text-xs uppercase">Validation message</td>
                      <td style={{ border: 'none', paddingTop: 6 }}>{escapeHtml(r.validation_msg || '—')}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-[var(--muted-fg)] small">Loading…</div>
              )}
            </div>

            <div className="col-span-1 md:col-span-1">
              <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold mb-2">History</p>
                <div style={{ maxHeight: 320, overflowY: 'auto' }} className="space-y-2">
                  {detailLoading ? (
                    <div className="text-center py-4 text-[var(--muted-fg)] small">Loading history…</div>
                  ) : detail?.history && detail.history.length === 0 ? (
                    <div className="text-center py-2 text-[var(--muted-fg)] small">No history yet.</div>
                  ) : (
                    detail?.history.map((h, i) => (
                      <div key={i} className="border-l-2 border-solid border-[var(--border)] pl-3 pb-2">
                        <div className="text-xs text-[var(--muted-fg)]">{escapeHtml(h.ts)}</div>
                        <div className="text-[12px]">{escapeHtml(h.event)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Correction resubmit */}
          {r && r.queue === 'correction' && (
            <div className="mt-4 flex gap-3">
              <button
                className="btn btn-primary"
                disabled={correcting === r.report_id}
                onClick={() => handleCorrect(r)}
              >
                {correcting === r.report_id ? 'Resubmitting…' : 'Correct and resubmit'}
              </button>
              {correctionMsg && <span className="small self-center">{escapeHtml(correctionMsg)}</span>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
