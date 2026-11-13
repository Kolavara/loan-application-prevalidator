import { useEffect, useState } from 'react'
import { useApi, api } from '../api'
import { formatINR } from '../utils'
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  RotateCw, 
  Building2, 
  Sliders, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react'

export default function Handler() {
  const { data: handlers, run: runHandlers, loading: hLoading } = useApi(api.listHandlers, true)
  const [handlerId, setHandlerId] = useState<string | number | null>(null)
  const [selHandler, setSelHandler] = useState<any>(null)
  const { data: handlerReports, run: runHandlerReports, loading: rLoading } = useApi(api.getHandlerReports, false)
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
      setUpdateMsg('Capacity updated successfully')
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
      setUpdateMsg(res.error?.message || `Could not set status to ${status}`)
    }
  }

  const handlerList = handlers || []
  const reports = handlerReports || []
  const loadPct = selHandler ? Math.round((selHandler.load / Math.max(selHandler.capacity, 1)) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#1e293b]">Handler Desks & Officers</h2>
          <p className="text-[12px] text-[#94a3b8] font-medium">
            Monitor capacity, adjust officer availability, and advance loan report lifecycle.
          </p>
        </div>

        <button 
          onClick={() => runHandlers()}
          className="self-start sm:self-auto px-4 py-2 rounded-[12px] bg-white border border-[#f3f4f6] text-[#0d6efd] font-bold text-[12px] shadow-2xs hover:bg-[#eff6ff] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCw size={13} className={hLoading ? 'animate-spin' : ''} />
          Refresh Desks
        </button>
      </div>

      {/* Selected Handler & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Handler Selector & Profile Card: 7 cols */}
        <div className="lg:col-span-7 bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                Select Underwriting Handler
              </label>
              <select
                value={handlerId ?? ''}
                onChange={(e) => setHandlerId(e.target.value || null)}
                className="w-full sm:w-64 bg-[#f8f9fc] border border-[#e2e8f0] rounded-[12px] px-3.5 py-2 text-[13px] font-bold text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all cursor-pointer"
              >
                {handlerList.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.name} — {h.category} ({h.zone})
                  </option>
                ))}
              </select>
            </div>

            {selHandler && (
              <span className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-extrabold ${
                selHandler.available ? 'bg-[#ecfdf5] text-[#10b981]' : 'bg-red-50 text-red-500'
              }`}>
                {selHandler.available ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {selHandler.available ? 'Active & Receiving' : 'Unavailable'}
              </span>
            )}
          </div>

          {selHandler && (
            <div className="bg-[#f8f9fc] p-4.5 rounded-[18px] border border-[#f1f5f9] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-extrabold text-[#1e293b]">{selHandler.name}</h3>
                  <p className="text-[12px] text-[#64748b] font-medium mt-0.5">
                    {selHandler.role} · {selHandler.category} Loans · Zone {selHandler.zone}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-extrabold text-[#0d6efd] bg-white border border-[#dbeafe] px-2.5 py-1 rounded-[8px]">
                    Authority Level {selHandler.authority}
                  </span>
                </div>
              </div>

              {/* Load vs Capacity Progress */}
              <div>
                <div className="flex justify-between items-center text-[12px] font-bold mb-1.5">
                  <span className="text-[#64748b]">Assigned Workload</span>
                  <span className={loadPct >= 100 ? 'text-[#f97316]' : 'text-[#1e293b]'}>
                    {selHandler.load} / {selHandler.capacity} cases ({loadPct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      loadPct >= 100 ? 'bg-[#f97316]' : loadPct >= 60 ? 'bg-[#0d6efd]' : 'bg-[#10b981]'
                    }`}
                    style={{ width: `${Math.min(loadPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Adjust Capacity & Availability: 5 cols */}
        <div className="lg:col-span-5 bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between gap-4">
          <h3 className="text-[15px] font-extrabold text-[#1e293b] flex items-center gap-2">
            <Sliders size={16} className="text-[#0d6efd]" />
            Desk Configuration
          </h3>

          {selHandler && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Availability Status
                </label>
                <button
                  onClick={handleAvailability}
                  className={`w-full py-2.5 px-4 rounded-[12px] font-bold text-[13px] border transition-all cursor-pointer ${
                    selHandler.available
                      ? 'bg-white border-red-200 text-red-600 hover:bg-red-50'
                      : 'bg-white border-[#10b981] text-[#10b981] hover:bg-[#ecfdf5]'
                  }`}
                >
                  {selHandler.available ? 'Set Unavailable (Pause Intake)' : 'Set Available (Accept Intake)'}
                </button>
              </div>

              <form onSubmit={handleCapacity}>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Adjust Capacity (0–50)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    min="0"
                    max="50"
                    className="flex-1 bg-[#f8f9fc] border border-[#e2e8f0] rounded-[12px] px-3.5 py-2 text-[13px] font-bold text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-[12px] bg-[#0d6efd] text-white font-bold text-[12px] shadow-sm hover:bg-[#0b5ed7] transition-all cursor-pointer"
                  >
                    Save
                  </button>
                </div>
                {capError && <p className="text-[11px] text-red-500 font-medium mt-1">{capError}</p>}
              </form>

              {updateStatus !== 'idle' && (
                <p className={`text-[12px] font-bold ${updateStatus === 'ok' ? 'text-[#10b981]' : 'text-red-500'}`}>
                  {updateMsg}
                </p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Handler Reports Table */}
      <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#1e293b]">
              Reports Assigned to {selHandler?.name || 'Handler'}
            </h3>
            <p className="text-[12px] text-[#94a3b8] font-medium">
              {reports.length} report(s) currently allocated to this desk
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[#94a3b8] text-[11px] uppercase tracking-wider font-bold">
                <th className="pb-3 font-bold">Report ID</th>
                <th className="pb-3 font-bold">Code</th>
                <th className="pb-3 font-bold">Applicant</th>
                <th className="pb-3 font-bold">Amount</th>
                <th className="pb-3 font-bold text-center">Urgency</th>
                <th className="pb-3 font-bold text-center">Status</th>
                <th className="pb-3 text-right font-bold">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8f9fc]">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#94a3b8] font-medium">
                    No active reports assigned to this officer desk.
                  </td>
                </tr>
              ) : (
                reports.map((rep: any) => {
                  const canStart = rep.status === 'Assigned' || rep.status === 'Pending'
                  const canResolve = rep.status === 'In Progress' || rep.status === 'Assigned'
                  return (
                    <tr key={rep.report_id} className="hover:bg-[#f8f9fc] transition-colors">
                      <td className="py-3.5 font-mono font-bold text-[#0d6efd]">
                        {rep.report_id}
                      </td>
                      <td className="py-3.5 font-mono font-bold text-[#1e293b]">
                        {rep.application_code}
                      </td>
                      <td className="py-3.5 font-bold text-[#1e293b]">
                        {rep.reporter_name}
                      </td>
                      <td className="py-3.5 font-mono font-semibold text-[#1e293b]">
                        {formatINR(rep.amount)}
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          rep.urgency === 'critical' ? 'bg-red-50 text-red-600' :
                          rep.urgency === 'high' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#f1f5f9] text-[#64748b]'
                        }`}>
                          {rep.urgency || 'normal'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          rep.status === 'Resolved' ? 'bg-[#ecfdf5] text-[#10b981]' :
                          rep.status === 'In Progress' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#eff6ff] text-[#0d6efd]'
                        }`}>
                          {rep.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canStart && (
                            <button
                              onClick={() => handleStatus('In Progress', rep)}
                              className="px-3 py-1 rounded-[8px] bg-[#eff6ff] text-[#0d6efd] font-bold text-[11px] hover:bg-[#0d6efd] hover:text-white transition-all cursor-pointer"
                            >
                              Start Review
                            </button>
                          )}
                          {canResolve && (
                            <button
                              onClick={() => handleStatus('Resolved', rep)}
                              className="px-3 py-1 rounded-[8px] bg-[#ecfdf5] text-[#10b981] font-bold text-[11px] hover:bg-[#10b981] hover:text-white transition-all cursor-pointer"
                            >
                              Resolve Case
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

    </div>
  )
}
