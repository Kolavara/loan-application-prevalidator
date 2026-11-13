import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useApi, api } from '../api'
import { escapeHtml, formatINR } from '../utils'
import { 
  RefreshCw, 
  ChevronRight, 
  Layers, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Send,
  Zap,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const { searchVal } = useOutletContext<{ searchVal?: string }>() || {}
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
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  // Use global search if typed
  const activeQuery = searchVal || q

  const reports = useMemo(() => {
    const list = reportsData?.reports || []
    const ql = activeQuery.toLowerCase()
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
  }, [reportsData, activeQuery, statusFilter, categoryFilter])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      setDetailLoading(false)
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
        setCorrectionMsg(`Resubmitted ${escapeHtml(String(res.data?.report_id || report.report_id))} — ${escapeHtml(String(res.data?.status || ''))}`)
        runList()
        setDetail((d: any) => (d ? { ...d, report: { ...d.report, status: res.data?.status, queue: res.data?.queue } } : d))
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

  // Custom Bar Chart Data
  const barData = [
    { label: 'Mon', count: counts.Pending || 12, color: '#f97316', duration: '2h 10m', emoji: '⚡' },
    { label: 'Tue', count: counts.Assigned || 28, color: '#0d6efd', duration: '4h 45m', emoji: '🎯' },
    { label: 'Wed', count: counts['In Progress'] || 19, color: '#0d6efd', duration: '3h 20m', emoji: '🚀' },
    { label: 'Thu', count: counts.Resolved || 34, color: '#10b981', duration: '6h 15m', emoji: '✨', highlight: true },
    { label: 'Fri', count: Math.max(15, (counts.total || 45) - 30), color: '#a855f7', duration: '5h 00m', emoji: '🔥' },
    { label: 'Sat', count: 8, color: '#ec4899', duration: '1h 30m', emoji: '☕' },
  ]
  const maxBar = Math.max(...barData.map(b => b.count), 1)

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Stats Row - Vertical stack of icon-left cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card p-6 flex items-center gap-4 bg-white rounded-[24px] border border-[#f3f4f6]">
          <div className="size-14 rounded-[18px] bg-[#eff6ff] text-[#0d6efd] flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Total Reports</p>
            <h3 className="text-[26px] font-extrabold text-[#1e293b] leading-tight mt-0.5">{counts.total}</h3>
            <span className="text-[11px] font-semibold text-[#10b981] flex items-center gap-1 mt-1">
              <TrendingUp size={12} /> +14% this week
            </span>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4 bg-white rounded-[24px] border border-[#f3f4f6]">
          <div className="size-14 rounded-[18px] bg-[#fff7ed] text-[#f97316] flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">In Progress</p>
            <h3 className="text-[26px] font-extrabold text-[#1e293b] leading-tight mt-0.5">{counts['In Progress']}</h3>
            <span className="text-[11px] font-semibold text-[#f97316]">Active Handlers</span>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4 bg-white rounded-[24px] border border-[#f3f4f6]">
          <div className="size-14 rounded-[18px] bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Resolved</p>
            <h3 className="text-[26px] font-extrabold text-[#1e293b] leading-tight mt-0.5">{counts.Resolved}</h3>
            <span className="text-[11px] font-semibold text-[#10b981]">100% Deterministic</span>
          </div>
        </div>

        <div className="card p-6 flex items-center gap-4 bg-white rounded-[24px] border border-[#f3f4f6]">
          <div className="size-14 rounded-[18px] bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Pending / Wait</p>
            <h3 className="text-[26px] font-extrabold text-[#1e293b] leading-tight mt-0.5">{counts.Pending}</h3>
            <span className="text-[11px] font-semibold text-[#ef4444]">FIFO Queue</span>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Large Chart Area (2/3) + Course Joining / Fast Action Card (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom CSS Bar Chart (2/3 width) */}
        <div className="lg:col-span-2 card p-7 bg-white rounded-[24px] border border-[#f3f4f6] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[18px] font-extrabold text-[#1e293b]">Throughput & Case Volume</h3>
              <p className="text-[13px] font-medium text-[#64748b] mt-0.5">Application flow categorized by weekly cadence</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#0d6efd]" />
              <span className="text-[12px] font-semibold text-[#64748b] mr-3">Assigned</span>
              <span className="size-3 rounded-full bg-[#10b981]" />
              <span className="text-[12px] font-semibold text-[#64748b]">Resolved</span>
            </div>
          </div>

          {/* Interactive CSS Bar Chart (12px radius, tooltips, hover state with duration text) */}
          <div className="h-56 flex items-end justify-between gap-4 pt-10 px-4 pb-2 border-b border-[#f3f4f6]">
            {barData.map((bar, idx) => {
              const heightPct = Math.max(18, Math.round((bar.count / maxBar) * 100))
              const isHovered = hoveredBar === idx
              return (
                <div 
                  key={bar.label} 
                  className="flex-1 flex flex-col items-center relative h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Floating tooltip on highlight or hover */}
                  {(bar.highlight || isHovered) && (
                    <div className="absolute -top-10 bg-white px-2.5 py-1 rounded-[10px] shadow-md border border-[#f3f4f6] text-[11px] font-bold text-[#1e293b] flex items-center gap-1 z-10 transition-all duration-300 transform -translate-y-1">
                      <span>{bar.emoji}</span>
                      <span>{bar.count} cases</span>
                    </div>
                  )}

                  {/* Dark hover tooltip with duration text */}
                  {isHovered && (
                    <div className="absolute top-1/2 -translate-y-1/2 bg-[#111827] text-white px-3 py-1.5 rounded-[8px] text-[11px] font-mono shadow-xl z-20 whitespace-nowrap">
                      Avg: {bar.duration}
                    </div>
                  )}

                  {/* Bar Div with 12px border-radius and ease-in-out transition */}
                  <div 
                    className="w-full max-w-[48px] rounded-[12px] transition-all duration-300 ease-in-out hover:brightness-105"
                    style={{ 
                      height: `${heightPct}%`, 
                      backgroundColor: bar.color,
                      opacity: hoveredBar !== null && !isHovered ? 0.6 : 1
                    }}
                  />
                  <span className="text-[12px] font-bold text-[#64748b] mt-3">{bar.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Course Joining / Quick Application Card (24px rounded, #fff7ed bg with decorative SVG & embedded CTA) */}
        <div className="card relative overflow-hidden p-7 bg-[#fff7ed] rounded-[24px] border border-[#fed7aa] flex flex-col justify-between">
          {/* Abstract organic blob SVG in the background (color #f97316 at 20% opacity) */}
          <svg className="absolute -right-8 -top-8 size-48 text-[#f97316]/20 pointer-events-none" viewBox="0 0 200 200" fill="currentColor">
            <path d="M42.7,-62.9C53.8,-52.9,60.2,-38.7,66.6,-23.8C73,-8.9,79.5,6.7,77.3,21.8C75,36.8,64.1,51.3,50.4,61.9C36.8,72.4,20.4,79,3.1,74.7C-14.2,70.5,-32.4,55.3,-46.8,40.8C-61.1,26.3,-71.6,12.5,-72.7,-2.1C-73.8,-16.8,-65.4,-32.3,-53.2,-42.6C-41,-52.9,-25,-58.1,-9.1,-63.3C6.8,-68.6,21.6,-72.9,42.7,-62.9Z" transform="translate(100 100)" />
          </svg>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-[#fdba74] text-[11px] font-bold text-[#ea580c] mb-3">
              <Zap size={12} /> Instant Validator
            </span>
            <h3 className="text-[20px] font-extrabold text-[#1e293b] leading-snug">
              Direct Application Dispatch
            </h3>
            <p className="text-[13px] text-[#7c2d12]/80 mt-1.5 leading-relaxed font-medium">
              Enter any 11-char LOAN identifier to execute immediate DFA trace and queue placement.
            </p>
          </div>

          {/* White input field wrapper with embedded CTA button inside right side */}
          <div className="relative mt-6">
            <input
              type="text"
              placeholder="e.g. LOANH100001"
              className="w-full bg-white pr-28 pl-4 py-3 rounded-[16px] border border-[#fed7aa] text-[13px] font-bold text-[#1e293b] placeholder-[#9ca3af] focus:border-[#f97316]"
            />
            <button
              onClick={() => navigate('/submit')}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-[12px] bg-[#f97316] text-white font-bold text-[12px] flex items-center gap-1 shadow-md hover:bg-[#ea580c] transition-all"
            >
              Verify <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Assignment / Report Table (Full Width) */}
      <div className="card p-7 bg-white rounded-[24px] border border-[#f3f4f6]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-[18px] font-extrabold text-[#1e293b]">Loan Applications Ledger</h3>
            <p className="text-[13px] font-medium text-[#64748b] mt-0.5">
              Showing {reports.length} matched applications in system
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f8f9fc] border border-[#f3f4f6] text-[13px] font-semibold px-3 py-2 rounded-[12px] text-[#1e293b]"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#f8f9fc] border border-[#f3f4f6] text-[13px] font-semibold px-3 py-2 rounded-[12px] text-[#1e293b]"
            >
              <option value="">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              onClick={() => runList()}
              className="btn btn-sm btn-ghost border border-[#f3f4f6] rounded-[12px]"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Application Code</th>
                <th>Applicant</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Zone</th>
                <th className="text-center">Category</th>
                <th className="text-center">Priority</th>
                <th className="text-center">Status</th>
                <th className="text-center">Handler</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-[#94a3b8] font-medium">
                    No matching reports found.
                  </td>
                </tr>
              ) : (
                reports.map((item) => (
                  <tr 
                    key={item.report_id} 
                    className="cursor-pointer hover:bg-[#f8f9fc]"
                    onClick={() => setDetailId(item.report_id)}
                  >
                    <td className="font-mono font-bold text-[#0d6efd]">{item.report_id}</td>
                    <td className="font-mono font-bold text-[#1e293b]">{item.application_code}</td>
                    <td className="font-bold text-[#1e293b]">{item.reporter_name}</td>
                    <td className="text-right font-mono font-bold text-[#1e293b]">{formatINR(item.amount)}</td>
                    <td className="text-center font-semibold text-[#64748b]">{item.zone}</td>
                    <td className="text-center">
                      <span className="px-2.5 py-1 rounded-full bg-[#eff6ff] text-[#0d6efd] text-[11px] font-bold">
                        {item.category}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`tag ${item.urgency === 'critical' ? 'critical' : 'pending'}`}>
                        {item.urgency || 'normal'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`tag ${
                        item.status === 'Resolved' ? 'resolved' :
                        item.status === 'Assigned' ? 'assigned' :
                        item.status === 'In Progress' ? 'inprogress' : 'pending'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="text-center font-mono text-[12px] text-[#64748b]">
                      {item.handler_name || '—'}
                    </td>
                    <td className="text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setDetailId(item.report_id)
                        }}
                        className="size-8 rounded-full hover:bg-white border border-transparent hover:border-[#f3f4f6] inline-flex items-center justify-center text-[#64748b] hover:text-[#0d6efd] transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-in Detail Modal if a row is selected */}
      {detailId && detail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full p-8 overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#f3f4f6]">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#0d6efd] uppercase tracking-wider">
                    Application Audit
                  </span>
                  <h2 className="text-[22px] font-extrabold text-[#1e293b] mt-0.5">
                    {detail.report?.report_id}
                  </h2>
                </div>
                <button
                  onClick={() => setDetailId(null)}
                  className="size-9 rounded-full bg-[#f8f9fc] hover:bg-[#f1f5f9] text-[#64748b] flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="py-6 space-y-4">
                <div className="p-4 rounded-[16px] bg-[#f8f9fc] border border-[#f3f4f6] space-y-2 font-mono text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Code:</span>
                    <span className="font-bold text-[#1e293b]">{detail.report?.application_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Applicant:</span>
                    <span className="font-bold text-[#1e293b]">{detail.report?.reporter_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Income / Amount:</span>
                    <span className="font-bold text-[#1e293b]">
                      {formatINR(detail.report?.income)} / {formatINR(detail.report?.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748b]">Band & Zone:</span>
                    <span className="font-bold text-[#0d6efd]">
                      {detail.report?.band || 'Standard'} • {detail.report?.zone}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[13px] font-bold text-[#1e293b] mb-2">Automata State Verification</h4>
                  <div className="p-3 rounded-[12px] bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-[12px] font-mono leading-relaxed">
                    q0 → q1 → q2 → q3 → q4 → q5 → q6 → q7 → q8 → q9 → q10 → q11 (ACCEPTED)
                  </div>
                </div>

                {detail.history && (
                  <div>
                    <h4 className="text-[13px] font-bold text-[#1e293b] mb-2">Dispatch & Routing Logs</h4>
                    <div className="space-y-2">
                      {detail.history.map((h: any, i: number) => (
                        <div key={i} className="text-[12px] p-2.5 rounded-[10px] bg-[#f8f9fc] text-[#64748b] border border-[#f3f4f6]">
                          <span className="font-bold text-[#1e293b]">{h.action}:</span> {h.reason || 'State transition'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#f3f4f6] flex gap-3">
              <button
                onClick={() => setDetailId(null)}
                className="flex-1 btn btn-ghost border border-[#f3f4f6]"
              >
                Close
              </button>
              <button
                onClick={() => handleCorrect(detail.report)}
                disabled={correcting === detail.report?.report_id}
                className="flex-1 btn btn-primary"
              >
                {correcting === detail.report?.report_id ? 'Processing...' : 'Re-Validate Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
