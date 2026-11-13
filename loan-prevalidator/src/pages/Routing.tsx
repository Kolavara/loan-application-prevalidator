import { useMemo, useState } from 'react'
import { useApi, api } from '../api'
import { RotateCw, Play, Filter, AlertCircle, ShieldAlert, ArrowRight } from 'lucide-react'

export default function Routing() {
  const { data: routing, run: runRouting, loading: rLoading } = useApi(api.listRouting, true)
  const { data: handlers, run: runHandlers } = useApi(api.listHandlers, true)
  const { data: queue, run: runQueue } = useApi(api.getQueue, true)
  const [zoneFilter, setZoneFilter] = useState('')
  const [processStatus, setProcessStatus] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle')
  const [processMsg, setProcessMsg] = useState('')

  const rows = useMemo(() => {
    const list = routing || []
    const z = zoneFilter.toLowerCase()
    return z ? list.filter((r: any) => r.zone.toLowerCase().includes(z)) : list
  }, [routing, zoneFilter])

  const zones = useMemo(() => {
    const set = new Set<string>()
    ;(routing || []).forEach((r: any) => set.add(r.zone))
    return Array.from(set).sort()
  }, [routing])

  const handlerList = handlers || []
  const waiting = queue?.waiting || []
  const correction = queue?.correction || []
  const escalations = queue?.escalations || []
  const overrides = queue?.overrides || []

  const handleProcess = async () => {
    setProcessStatus('pending')
    setProcessMsg('')
    const res = await api.processQueue()
    if (res.ok) {
      setProcessStatus('ok')
      setProcessMsg(`Successfully processed ${res.data?.processed ?? 0} waiting report(s)`)
      runQueue()
      runRouting()
      runHandlers()
    } else {
      setProcessStatus('error')
      setProcessMsg(res.error?.message || 'Processing failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#1e293b]">Routing Matrix & Dispatch</h2>
          <p className="text-[12px] text-[#94a3b8] font-medium">
            Matrix mapping (Zone × Category × Band), queue processor, and escalation tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleProcess}
            disabled={waiting.length === 0 || processStatus === 'pending'}
            className="px-4 py-2 rounded-[12px] bg-[#0d6efd] text-white font-bold text-[12px] shadow-sm hover:bg-[#0b5ed7] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play size={13} fill="currentColor" />
            {processStatus === 'pending' ? 'Processing...' : `Process Waiting Queue (${waiting.length})`}
          </button>

          <button
            onClick={() => { runRouting(); runHandlers(); runQueue() }}
            className="px-3.5 py-2 rounded-[12px] bg-white border border-[#f3f4f6] text-[#64748b] hover:text-[#0d6efd] font-bold text-[12px] shadow-2xs hover:bg-[#eff6ff] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw size={13} className={rLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {processStatus !== 'idle' && (
        <div className={`p-4 rounded-[16px] text-[13px] font-bold ${
          processStatus === 'ok' ? 'bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46]' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {processMsg}
        </div>
      )}

      {/* Queues Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Waiting Queue */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-extrabold text-[#1e293b] flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#f97316]" />
              Waiting Queue ({waiting.length})
            </h3>
            <span className="text-[11px] font-bold text-[#94a3b8]">Awaiting Officer Capacity</span>
          </div>

          <div className="overflow-x-auto max-h-[220px]">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[#94a3b8] uppercase font-bold text-[10px]">
                  <th className="pb-2">Report ID</th>
                  <th className="pb-2">Applicant</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8f9fc]">
                {waiting.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#94a3b8]">Waiting queue is empty.</td>
                  </tr>
                ) : (
                  waiting.map((rep: any) => (
                    <tr key={rep.report_id} className="hover:bg-[#f8f9fc]">
                      <td className="py-2.5 font-mono font-bold text-[#0d6efd]">{rep.report_id}</td>
                      <td className="py-2.5 font-bold text-[#1e293b]">{rep.reporter_name}</td>
                      <td className="py-2.5 text-[#64748b]">{rep.category}</td>
                      <td className="py-2.5 text-right font-medium">{rep.zone}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Correction Queue */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-extrabold text-[#1e293b] flex items-center gap-2">
              <span className="size-2 rounded-full bg-red-500" />
              Correction Queue ({correction.length})
            </h3>
            <span className="text-[11px] font-bold text-[#94a3b8]">DFA Trap / Validation Failures</span>
          </div>

          <div className="overflow-x-auto max-h-[220px]">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[#94a3b8] uppercase font-bold text-[10px]">
                  <th className="pb-2">Report ID</th>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8f9fc]">
                {correction.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[#94a3b8]">No rejected items.</td>
                  </tr>
                ) : (
                  correction.map((rep: any) => (
                    <tr key={rep.report_id} className="hover:bg-[#f8f9fc]">
                      <td className="py-2.5 font-mono font-bold text-red-500">{rep.report_id}</td>
                      <td className="py-2.5 font-mono font-bold text-[#1e293b]">{rep.application_code}</td>
                      <td className="py-2.5 text-red-600 font-medium">{rep.validation_msg || 'Rejected by rule'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Routing Table */}
      <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#1e293b]">Dispatch Routing Matrix</h3>
            <p className="text-[12px] text-[#94a3b8] font-medium">
              Deterministic routing rules (Zone × Category × Amount Band = 60 rules)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[#94a3b8]" />
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-[10px] px-3 py-1.5 text-[12px] font-bold text-[#1e293b] focus:outline-hidden cursor-pointer"
            >
              <option value="">All Zones ({rows.length} rows)</option>
              {zones.map((z: string) => (
                <option key={z} value={z}>{z} Zone</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#f3f4f6] text-[#94a3b8] text-[11px] uppercase tracking-wider font-bold">
                <th className="pb-3 font-bold">Zone</th>
                <th className="pb-3 font-bold">Category</th>
                <th className="pb-3 font-bold">Amount Band</th>
                <th className="pb-3 font-bold">Branch</th>
                <th className="pb-3 font-bold">Assigned Team</th>
                <th className="pb-3 font-bold">Depot</th>
                <th className="pb-3 text-center font-bold">Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8f9fc]">
              {rows.map((row: any, idx: number) => (
                <tr key={`${row.zone}|${row.category}|${row.band}|${idx}`} className="hover:bg-[#f8f9fc] transition-colors">
                  <td className="py-2.5 font-bold text-[#1e293b]">{row.zone}</td>
                  <td className="py-2.5 font-medium text-[#0d6efd]">{row.category}</td>
                  <td className="py-2.5 font-mono text-[12px] font-semibold text-[#64748b]">{row.band}</td>
                  <td className="py-2.5 text-[#1e293b]">{row.branch}</td>
                  <td className="py-2.5 text-[#64748b]">{row.team}</td>
                  <td className="py-2.5 text-[#64748b]">{row.depot}</td>
                  <td className="py-2.5 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-[6px] text-[11px] font-bold bg-[#eff6ff] text-[#0d6efd]">
                      Level {row.authority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
