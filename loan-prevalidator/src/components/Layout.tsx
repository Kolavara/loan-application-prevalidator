import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Table, 
  BarChart3, 
  RefreshCw, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Search,
  Bell
} from 'lucide-react'
import { api } from '../api'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/submit', label: 'Submit Application', icon: FileText },
  { path: '/handlers', label: 'Handlers & Teams', icon: Users },
  { path: '/routing', label: 'Routing Matrix', icon: Table },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Layout() {
  const [seeding, setSeeding] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => 
    location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path))

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.demoSeed()
      window.location.reload()
    } finally {
      setSeeding(false)
    }
  }

  // Mini-calendar days
  const days = [
    { day: 'Mon', date: '11' },
    { day: 'Tue', date: '12' },
    { day: 'Wed', date: '13', active: true },
    { day: 'Thu', date: '14' },
    { day: 'Fri', date: '15' },
    { day: 'Sat', date: '16' },
    { day: 'Sun', date: '17' },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8f9fc] text-[#1e293b] font-sans antialiased">
      {/* 1. Left Navigation Sidebar (256px wide, #ffffff, 1px border-right #f3f4f6) */}
      <aside className="w-[256px] h-full shrink-0 flex flex-col justify-between bg-white border-r border-[#f3f4f6] p-6 z-20">
        <div>
          {/* Logo with dual circular glyphs */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="flex items-center -space-x-1.5">
              <span className="size-6 rounded-full bg-[#0d6efd] shadow-sm flex items-center justify-center text-white font-bold text-xs">L</span>
              <span className="size-6 rounded-full bg-[#f97316] opacity-90 shadow-sm flex items-center justify-center text-white font-bold text-xs">P</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[17px] tracking-tight leading-tight text-[#1e293b]">LoanPilot</span>
              <span className="text-[11px] font-semibold text-[#64748b]">DFA Pre-Validator</span>
            </div>
          </div>

          {/* Org Selector Button (orange background #fff7ed, 12px radius) */}
          <button className="w-full flex items-center justify-between p-3 mb-6 bg-[#fff7ed] border border-[#ffedd5] rounded-[12px] text-left transition-all duration-300 hover:shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="size-7 rounded-[8px] bg-[#f97316] text-white flex items-center justify-center font-bold text-xs">
                HQ
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#1e293b] leading-tight">Central Division</p>
                <p className="text-[11px] text-[#f97316] font-medium">Auto-Routing Active</p>
              </div>
            </div>
            <span className="text-xs text-[#f97316] font-semibold">Switch</span>
          </button>

          {/* Vertical Navigation Links (12px padding, active rounded vertical indicator pill) */}
          <nav className="space-y-1.5">
            {NAV.map((item) => {
              const active = isActive(item.path)
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-[12px] text-[14px] font-semibold transition-all duration-300 text-left ${
                    active
                      ? 'bg-[#eff6ff] text-[#0d6efd]'
                      : 'text-[#64748b] hover:bg-[#f8f9fc] hover:text-[#1e293b]'
                  }`}
                >
                  {/* Active rounded vertical indicator pill */}
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1.5 bg-[#0d6efd] rounded-r-full" />
                  )}
                  <Icon size={19} className={active ? 'text-[#0d6efd]' : 'text-[#64748b]'} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom Promo / Architecture Card (gradient blue-50 to indigo-50 with floating badge) */}
        <div className="relative mt-auto p-4 rounded-[20px] bg-gradient-to-br from-[#eff6ff] to-[#e0e7ff] border border-[#dbeafe]">
          <div className="absolute -top-3 right-4 size-7 rounded-full bg-[#0d6efd] text-white shadow-md flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <p className="text-[13px] font-bold text-[#1e293b]">Automata Engine</p>
          <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
            Deterministic q0-q11 state transitions verified with dual regex.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="text-[12px] font-bold text-[#0d6efd] flex items-center gap-1 hover:underline"
            >
              <RefreshCw size={11} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Seeding...' : 'Run Demo Seed'}
            </button>
            <span className="text-[10px] font-mono bg-white/80 px-2 py-0.5 rounded-full text-[#0d6efd] font-bold border border-[#bfdbfe]">
              v2.4
            </span>
          </div>
        </div>
      </aside>

      {/* 2. Main Central Fluid Content Area */}
      <main className="flex-1 h-full overflow-y-auto px-8 py-7 flex flex-col gap-6">
        {/* Top Header with 3xl font-weight greeting & pill-shaped search bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-[#1e293b]">
              Hello, Reviewer 👋
            </h1>
            <p className="text-[14px] font-medium text-[#64748b] mt-0.5">
              Automated credit evaluation, DFA classification & dispatch system
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Pill-shaped search bar (bg-white, rounded-full, px-11) */}
            <div className="relative w-72">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search cases or codes..."
                className="w-full bg-white pl-11 pr-4 py-2.5 rounded-full border border-[#f3f4f6] text-[13px] font-medium placeholder-[#94a3b8] focus:border-[#0d6efd] shadow-sm transition-all"
              />
            </div>

            <button className="size-10 rounded-full bg-white border border-[#f3f4f6] text-[#64748b] hover:text-[#1e293b] flex items-center justify-center shadow-sm transition-all">
              <Bell size={17} />
            </button>

            <button
              onClick={handleSeed}
              disabled={seeding}
              className="btn btn-sm btn-primary rounded-[12px] shadow-lg shadow-[#0d6efd]/20"
            >
              <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
              <span>{seeding ? 'Seeding...' : 'Seed Data'}</span>
            </button>
          </div>
        </header>

        {/* Outlet for Pages */}
        <div className="flex-1 pb-10">
          <Outlet context={{ navigate, searchVal }} />
        </div>
      </main>

      {/* 3. Right Sidebar (Profile & Activity, Width 320px, #ffffff, 1px border-left #f3f4f6) */}
      <aside className="w-[320px] h-full shrink-0 hidden xl:flex flex-col justify-between bg-white border-l border-[#f3f4f6] p-6 overflow-y-auto">
        <div className="space-y-6">
          {/* User Profile Card */}
          <div className="flex flex-col items-center text-center p-4 rounded-[24px] bg-[#f8f9fc] border border-[#f3f4f6]">
            <div className="relative size-20 rounded-full overflow-hidden border-2 border-white shadow-md mb-3 bg-[#e2e8f0] flex items-center justify-center">
              <span className="text-xl font-extrabold text-[#0d6efd]">AD</span>
            </div>
            <h3 className="text-[16px] font-bold text-[#1e293b]">Aditya Rao</h3>
            <p className="text-[12px] font-medium text-[#64748b]">Senior Risk Underwriter</p>
            <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[#10b981] text-[11px] font-bold">
              <ShieldCheck size={13} />
              Authority Level 3
            </div>

            <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#f1f5f9]">
              <div>
                <span className="block text-[18px] font-extrabold text-[#1e293b]">98.4%</span>
                <span className="text-[11px] font-medium text-[#94a3b8]">Pass Rate</span>
              </div>
              <div>
                <span className="block text-[18px] font-extrabold text-[#0d6efd]">14ms</span>
                <span className="text-[11px] font-medium text-[#94a3b8]">DFA Latency</span>
              </div>
            </div>
          </div>

          {/* Mini-Calendar (Horizontal day scroller with active day highlighted in #ec4899) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[#1e293b] flex items-center gap-1.5">
                <Calendar size={15} className="text-[#ec4899]" />
                Dispatch Schedule
              </h3>
              <span className="text-[11px] font-semibold text-[#64748b]">Nov 2026</span>
            </div>

            <div className="flex items-center justify-between gap-1.5 py-1">
              {days.map((d) => (
                <div
                  key={d.day}
                  className={`flex flex-col items-center py-2 px-2.5 rounded-[12px] transition-all duration-300 cursor-pointer ${
                    d.active
                      ? 'bg-[#ec4899] text-white -translate-y-1 shadow-md shadow-[#ec4899]/30 font-bold'
                      : 'text-[#64748b] hover:bg-[#f8f9fc] hover:text-[#1e293b]'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider">{d.day}</span>
                  <span className="text-[14px] font-extrabold mt-0.5">{d.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Class / Priority Escalations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold text-[#1e293b] flex items-center gap-1.5">
                <Clock size={15} className="text-[#f97316]" />
                Urgent Escalations
              </h3>
              <span className="text-[11px] font-bold text-[#f97316] bg-[#fff7ed] px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-[16px] bg-[#f8f9fc] border border-[#f3f4f6] flex items-start gap-3 transition-all hover:border-[#f97316]/30">
                <span className="size-2 rounded-full bg-[#ef4444] mt-1.5 shrink-0 animate-ping" />
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#1e293b] leading-tight">Emergency Cap Override</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">RPT-000007 • Central Depot</p>
                </div>
                <ArrowRight size={14} className="text-[#94a3b8]" />
              </div>

              <div className="p-3 rounded-[16px] bg-[#f8f9fc] border border-[#f3f4f6] flex items-start gap-3 transition-all hover:border-[#0d6efd]/30">
                <span className="size-2 rounded-full bg-[#0d6efd] mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#1e293b] leading-tight">Senior Band Review</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">LOANV992100 • Authority 2</p>
                </div>
                <ArrowRight size={14} className="text-[#94a3b8]" />
              </div>
            </div>
          </div>

          {/* Todo List with custom checkboxes */}
          <div>
            <h3 className="text-[14px] font-bold text-[#1e293b] mb-3 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-[#10b981]" />
              Daily Verification Checklist
            </h3>

            <div className="space-y-2">
              {[
                { text: 'Sync 60 routing matrix cells', done: true },
                { text: 'Check waiting queue backpressure', done: true },
                { text: 'Verify q4-q11 digit automata', done: false },
                { text: 'Audit Executive band approvals', done: false },
              ].map((todo, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2.5 p-2 rounded-[12px] hover:bg-[#f8f9fc] cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    defaultChecked={todo.done}
                    className="size-4 rounded-[6px] text-[#10b981] border-[#cbd5e1] focus:ring-[#10b981]/20"
                  />
                  <span className={`text-[12px] font-medium ${todo.done ? 'line-through text-[#94a3b8]' : 'text-[#1e293b]'}`}>
                    {todo.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-[#f3f4f6] flex items-center justify-between text-[11px] text-[#94a3b8] font-medium">
          <span>Port 5000 (Flask API)</span>
          <span className="flex items-center gap-1 text-[#10b981]">
            <span className="size-1.5 rounded-full bg-[#10b981]" /> Connected
          </span>
        </div>
      </aside>
    </div>
  )
}
