import { useMemo } from 'react'
import { useApi } from '../api'
import { api } from '../api'
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts'
import { escapeHtml, formatINR } from '../utils'

export default function Analytics() {
  const { data: analytics } = useApi(api.getAnalytics, true)

  const data = analytics || {
    total: 0, by_zone: [], by_category: {}, by_status: {}, by_priority: {},
    resolved: 0, unresolved: 0, waiting: 0, correction: 0, escalated: 0,
  }

  const zoneData = useMemo(() => data.by_zone || [], [data.by_zone])
  const catData = useMemo(() => Object.entries(data.by_category || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_category])
  const statusData = useMemo(() => Object.entries(data.by_status || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_status])
  const priorityData = useMemo(() => Array.isArray(data.by_priority) ? data.by_priority : Object.entries(data.by_priority || {}).map(([label, n]) => ({ label, n: n as number })), [data.by_priority])

  const statusColor = (label: string) => {
    const s = label.toLowerCase()
    if (s === 'resolved') return '#1f4d3a'
    if (s === 'in progress') return '#a8721e'
    if (s === 'pending') return '#8a8579'
    if (s === 'rejected') return '#7a1f2b'
    return '#5c574e'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-8">
        <div>
          <h2 className="mb-1">Analytics</h2>
          <p className="small">Counts by zone, category, status, priority and queue.</p>
        </div>
        <div className="text-right">
          <div className="mono text-[18px] font-bold">{data.total}</div>
          <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider">Total reports</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          ['Resolved', data.resolved, '#1f4d3a'],
          ['Unresolved', data.unresolved, '#a8721e'],
          ['Waiting', data.waiting, '#8a8579'],
          ['Correction', data.correction, '#7a1f2b'],
          ['Escalated', data.escalated, '#7a1f2b'],
        ].map(([label, value, color]) => (
          <div key={label} className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs text-[var(--muted-fg)] uppercase tracking-wider font-semibold mb-1">{label}</p>
            <div className="mono text-[20px] font-bold" style={{ color: color as string }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="section-title mb-3">Reports by zone</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={zoneData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3d6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c574e' }} />
                <YAxis hide tick={{ fontSize: 10, fill: '#5c574e' }} />
                <Tooltip />
                <Bar dataKey="n" fill="#1f4d3a" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {zoneData.length === 0 && <p className="text-center py-8 text-[var(--muted-fg)] small">No zone data.</p>}
        </div>

        <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="section-title mb-3">Reports by category</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3d6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c574e' }} />
                <YAxis hide tick={{ fontSize: 10, fill: '#5c574e' }} />
                <Tooltip />
                <Bar dataKey="n" fill="#1f4d3a" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {catData.length === 0 && <p className="text-center py-8 text-[var(--muted-fg)] small">No category data.</p>}
        </div>

        <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="section-title mb-3">Reports by status</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="n"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  labelLine={false}
                  label={{ position: 'outside', fontSize: 11, fill: '#1d1b16' }}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={statusColor(entry.label)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {statusData.length === 0 && <p className="text-center py-8 text-[var(--muted-fg)] small">No status data.</p>}
        </div>

        <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="section-title mb-3">Reports by priority</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="n"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  labelLine={false}
                  label={{ position: 'outside', fontSize: 11, fill: '#1d1b16' }}
                >
                  {priorityData.map((entry, i) => (
                    <Cell key={`pcell-${i}`} fill={statusColor(entry.label)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {priorityData.length === 0 && <p className="text-center py-8 text-[var(--muted-fg)] small">No priority data.</p>}
        </div>
      </div>

      <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="section-title mb-3">Resolved vs unresolved</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ label: 'Resolved', n: data.resolved }, { label: 'Unresolved', n: data.unresolved }]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3d6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c574e' }} />
              <YAxis hide tick={{ fontSize: 10, fill: '#5c574e' }} />
              <Tooltip />
              <Bar dataKey="n" radius={[2, 2, 0, 0]}>
                <Cell fill="#1f4d3a" />
                <Cell fill="#a8721e" />
                <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-solid border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="section-title mb-3">Queue &amp; escalation counts</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { label: 'Waiting', n: data.waiting },
              { label: 'Correction', n: data.correction },
              { label: 'Escalated', n: data.escalated },
            ]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3d6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c574e' }} />
              <YAxis hide tick={{ fontSize: 10, fill: '#5c574e' }} />
              <Tooltip />
              <Bar dataKey="n" radius={[2, 2, 0, 0]}>
                <Cell fill="#8a8579" />
                <Cell fill="#a8721e" />
                <Cell fill="#7a1f2b" />
                <LabelList dataKey="n" position="insideTop" fill="#ffffff" fontSize={11} fontWeight="700" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
