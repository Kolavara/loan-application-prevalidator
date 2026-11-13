import { useMemo } from 'react'
import { useApi, api } from '../api'
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts'
import { TrendingUp, PieChart as PieIcon, BarChart3, AlertCircle } from 'lucide-react'

export default function Analytics() {
  const { data: analytics, loading } = useApi(api.getAnalytics, true)

  const data = analytics || {
    total: 0, by_zone: [], by_category: {}, by_status: {}, by_priority: {},
    resolved: 0, unresolved: 0, waiting: 0, correction: 0, escalated: 0,
  }

  const zoneData = useMemo(() => data.by_zone || [], [data.by_zone])
  const catData = useMemo(() => Object.entries(data.by_category || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_category])
  const statusData = useMemo(() => Object.entries(data.by_status || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_status])
  const priorityData = useMemo(() => Array.isArray(data.by_priority) ? data.by_priority : Object.entries(data.by_priority || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_priority])

  const STATUS_COLORS: Record<string, string> = {
    'Resolved': '#10b981',
    'In Progress': '#f97316',
    'Assigned': '#0d6efd',
    'Pending': '#64748b',
    'Rejected': '#ef4444',
  }

  const PRIORITY_COLORS: Record<string, string> = {
    'critical': '#ef4444',
    'high': '#f97316',
    'normal': '#0d6efd',
    'low': '#94a3b8',
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold text-[#1e293b]">Analytics & Performance</h2>
          <p className="text-[12px] text-[#94a3b8] font-medium">
            System throughput, zone allocations, category volume, and resolution metrics.
          </p>
        </div>

        <div className="text-right">
          <div className="font-mono text-[22px] font-extrabold text-[#0d6efd]">{data.total}</div>
          <p className="text-[11px] text-[#94a3b8] uppercase font-bold tracking-wider">Total Reports</p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        {[
          { label: 'Resolved', value: data.resolved, color: 'text-[#10b981]', bg: 'bg-[#ecfdf5]', border: 'border-[#a7f3d0]' },
          { label: 'Unresolved', value: data.unresolved, color: 'text-[#0d6efd]', bg: 'bg-[#eff6ff]', border: 'border-[#bfdbfe]' },
          { label: 'Waiting Queue', value: data.waiting, color: 'text-[#f97316]', bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]' },
          { label: 'Correction', value: data.correction, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
          { label: 'Escalations', value: data.escalated, color: 'text-[#a855f7]', bg: 'bg-[#faf5ff]', border: 'border-[#e9d5ff]' },
        ].map((item) => (
          <div key={item.label} className={`p-4 rounded-[20px] bg-white border border-[#f3f4f6] shadow-xs flex flex-col justify-between`}>
            <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">{item.label}</p>
            <div className={`font-mono text-[24px] font-extrabold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid 1: Zone & Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Reports by Zone */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between">
          <h3 className="text-[15px] font-extrabold text-[#1e293b] mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#0d6efd]" />
            Volume by Geographic Zone
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="n" fill="#0d6efd" radius={[8, 8, 0, 0]}>
                  <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reports by Category */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between">
          <h3 className="text-[15px] font-extrabold text-[#1e293b] mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#f97316]" />
            Volume by Loan Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="n" fill="#f97316" radius={[8, 8, 0, 0]}>
                  <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Charts Grid 2: Status & Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Reports by Status */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between">
          <h3 className="text-[15px] font-extrabold text-[#1e293b] mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-[#10b981]" />
            Status Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="n"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {statusData.map((entry) => (
                    <Cell 
                      key={entry.label} 
                      fill={STATUS_COLORS[entry.label] || '#94a3b8'} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reports by Priority */}
        <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs flex flex-col justify-between">
          <h3 className="text-[15px] font-extrabold text-[#1e293b] mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-[#ec4899]" />
            Priority Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="n"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {priorityData.map((entry) => (
                    <Cell 
                      key={entry.label} 
                      fill={PRIORITY_COLORS[String(entry.label).toLowerCase()] || '#94a3b8'} 
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  )
}
