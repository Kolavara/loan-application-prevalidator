import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Table, 
  BarChart3, 
  RefreshCw, 
  Award, 
  ChevronDown,
  Search,
  Bell,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  CheckSquare, 
  Square
} from 'lucide-react'
import { api } from '../api'

const NAV = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/submit', label: 'Submit Application', icon: FileText },
  { path: '/handlers', label: 'Handler Desks', icon: Users },
  { path: '/routing', label: 'Routing Matrix', icon: Table },
  { path: '/analytics', label: 'Analytics & Queues', icon: BarChart3 },
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

  // Mini-calendar days matching image exactly
  const calendarDays = [
    { day: 'Wed', date: '08' },
    { day: 'Thu', date: '09' },
    { day: 'Fri', date: '10', active: true },
    { day: 'Sat', date: '11' },
    { day: 'Sun', date: '12' },
  ]

  // Operational checklist matching reference
  const [todos, setTodos] = useState([
    { id: 1, text: 'Verify dual DFA & regex consistency', done: true },
    { id: 2, text: 'Review waiting queue assignments', done: false },
    { id: 3, text: 'Audit high-urgency escalations', done: false },
  ])

  return (
    <div className="flex min-h-screen w-full bg-[#f8f9fc] text-[#1e293b] font-sans antialiased p-3 sm:p-5 lg:p-7 justify-center items-center">
      {/* 1440px wide outer application shell with rounded-3xl container */}
      <div className="w-full max-w-[1440px] min-h-[920px] bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#f1f5f9] flex flex-col xl:flex-row overflow-hidden">
        
        {/* ================= LEFT SIDEBAR (Width 256px, #ffffff, 1px border-right) ================= */}
        <aside className="w-full xl:w-[256px] shrink-0 flex flex-col justify-between bg-white border-b xl:border-b-0 xl:border-r border-[#f3f4f6] p-6 z-20">
          <div>
            {/* Logo: oo LoanPilot */}
            <div className="flex items-center gap-3 mb-7 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="flex items-center -space-x-1.5">
                <span className="size-5 rounded-full border-[2.5px] border-[#0d6efd] bg-transparent" />
                <span className="size-5 rounded-full border-[2.5px] border-[#0d6efd] bg-transparent" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[18px] tracking-tight text-[#1e293b] leading-tight">
                  loan.<span className="text-[#0d6efd]">PILOT</span>
                </span>
                <span className="text-[10px] text-[#94a3b8] font-medium leading-none mt-0.5">DFA Pre-Validator System</span>
              </div>
            </div>

            {/* Organization Selector Button (orange background #fff7ed, 12px radius) */}
            <button className="w-full flex items-center justify-between px-3.5 py-2.5 mb-7 bg-[#fff7ed] border border-[#ffedd5] rounded-[12px] text-left transition-all duration-300 hover:shadow-xs group cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="size-6 rounded-full bg-[#f97316]/15 text-[#f97316] flex items-center justify-center font-bold text-xs">
                  🏛️
                </span>
                <span className="text-[13px] font-bold text-[#1e293b] leading-tight">Central Division</span>
              </div>
              <ChevronDown size={15} className="text-[#f97316] group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* Menu Label */}
            <p className="px-3.5 font-bold text-[11px] uppercase tracking-wider text-[#94a3b8] mb-3">
              MENU
            </p>

            {/* Vertical Navigation Links */}
            <nav className="space-y-1">
              {NAV.map((item) => {
                const active = isActive(item.path)
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-[12px] text-[14px] font-semibold transition-all duration-300 text-left cursor-pointer ${
                      active
                        ? 'bg-[#eff6ff] text-[#0d6efd]'
                        : 'text-[#64748b] hover:bg-[#f8f9fc] hover:text-[#1e293b]'
                    }`}
                  >
                    {/* Rounded vertical indicator pill */}
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-1.5 bg-[#0d6efd] rounded-r-full" />
                    )}
                    <Icon size={18} className={active ? 'text-[#0d6efd]' : 'text-[#94a3b8]'} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Bottom Promo Card: DFA Engine v2.4 with gradient & floating badge */}
          <div className="relative mt-8 p-4 rounded-[24px] bg-gradient-to-br from-[#eff6ff] to-[#e0e7ff] border border-[#dbeafe] text-center">
            <div className="mx-auto size-11 rounded-[16px] bg-white shadow-sm flex items-center justify-center text-[#f97316] -mt-8 mb-2 border border-[#eff6ff]">
              <Award size={22} className="text-[#f97316]" />
            </div>
            <h4 className="text-[13px] font-extrabold text-[#1e293b]">Automata Engine</h4>
            <p className="text-[11px] text-[#64748b] mt-1 leading-snug">
              Deterministic q0–q11 DFA state transitions verified with dual regex.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="mt-3 w-full py-2 rounded-[10px] bg-white text-[11px] font-bold text-[#0d6efd] shadow-xs hover:bg-[#0d6efd] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Seeding Database...' : 'Run Demo Seed v2.4'}
            </button>
          </div>
        </aside>

        {/* ================= MAIN CONTENT AREA (Central Fluid Column, #f8f9fc) ================= */}
        <main className="flex-1 overflow-y-auto px-5 sm:px-7 py-7 bg-[#f8f9fc] flex flex-col gap-6">
          {/* Top Header: Greeting + Search Bar */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-[#64748b]">Good morning,</p>
              <h1 className="text-[26px] font-extrabold tracking-tight text-[#1e293b] flex items-center gap-2">
                Alex Morgan <span className="text-xl">⛅</span>
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Pill-shaped search bar (bg-white, rounded-full, px-11) */}
              <div className="relative w-full sm:w-64 md:w-80">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search applications or codes..."
                  className="w-full bg-white pl-11 pr-4 py-2.5 rounded-full border border-transparent shadow-[0_2px_6px_rgba(0,0,0,0.03)] text-[13px] font-medium placeholder-[#94a3b8] focus:border-[#0d6efd] focus:outline-hidden transition-all"
                />
              </div>

              {/* Orange circular notification bell button */}
              <button 
                onClick={handleSeed}
                title="Seed demo cases"
                className="size-10 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-md shadow-[#f97316]/20 hover:bg-[#ea580c] transition-all shrink-0 cursor-pointer"
              >
                <Bell size={17} />
              </button>
            </div>
          </header>

          {/* Child Page Content */}
          <div className="flex-1 pb-4">
            <Outlet context={{ navigate, searchVal }} />
          </div>
        </main>

        {/* ================= RIGHT SIDEBAR (Profile & Activity, Width 320px, #ffffff) ================= */}
        <aside className="w-full xl:w-[320px] shrink-0 flex flex-col justify-between bg-white border-t xl:border-t-0 xl:border-l border-[#f3f4f6] p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {/* Top icons: star & sparkles */}
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-sm cursor-pointer hover:text-[#f97316]">✩</span>
              <Sparkles size={16} className="text-[#10b981]" />
            </div>

            {/* 1. User Profile */}
            <div className="flex flex-col items-center text-center">
              <div className="size-20 rounded-full overflow-hidden border-2 border-white shadow-md mb-2 bg-[#cbd5e1] flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80" 
                  alt="Alex Morgan"
                  className="size-full object-cover"
                />
              </div>
              <h3 className="text-[17px] font-extrabold text-[#1e293b]">Alex Morgan</h3>
              <p className="text-[12px] font-medium text-[#94a3b8]">@alex.underwriter</p>

              {/* Stats table/list */}
              <div className="w-full mt-4 space-y-2 text-[12px] font-medium text-[#64748b]">
                <div className="flex justify-between">
                  <span>Role:</span>
                  <span className="font-bold text-[#1e293b]">Senior Underwriter</span>
                </div>
                <div className="flex justify-between">
                  <span>Division:</span>
                  <span className="font-bold text-[#1e293b]">Credit Operations</span>
                </div>
                <div className="flex justify-between">
                  <span>Clearance:</span>
                  <span className="font-bold text-[#1e293b]">Level 3 (Exec)</span>
                </div>
              </div>

              {/* Submit Application CTA Button */}
              <button 
                onClick={() => navigate('/submit')}
                className="mt-4 w-full py-2.5 rounded-[12px] bg-[#0d6efd] text-white font-bold text-[13px] shadow-lg shadow-[#0d6efd]/25 hover:bg-[#0b5ed7] transition-all cursor-pointer"
              >
                Submit New Application
              </button>
            </div>

            {/* 2. Mini-Calendar Widget (Horizontal day selector, active #ec4899 with -4px transform) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <ChevronLeft size={16} className="text-[#94a3b8] cursor-pointer hover:text-[#1e293b]" />
                <span className="text-[14px] font-extrabold text-[#1e293b]">November 2024</span>
                <ChevronRight size={16} className="text-[#94a3b8] cursor-pointer hover:text-[#1e293b]" />
              </div>

              <div className="flex items-center justify-between gap-1.5 py-1">
                {calendarDays.map((d) => (
                  <div
                    key={d.day}
                    className={`flex flex-col items-center py-2 px-2.5 rounded-[12px] transition-all duration-300 cursor-pointer ${
                      d.active
                        ? 'bg-[#ec4899] text-white -translate-y-1 shadow-lg shadow-[#ec4899]/30 font-bold'
                        : 'text-[#64748b] hover:bg-[#f8f9fc] hover:text-[#1e293b]'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{d.day}</span>
                    <span className="text-[14px] font-extrabold mt-0.5">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Active Desks ('Upcoming Reviews') */}
            <div>
              <h4 className="text-[14px] font-extrabold text-[#1e293b] mb-3">
                Active Desks
              </h4>
              <div className="space-y-2.5">
                <div 
                  onClick={() => navigate('/handlers')}
                  className="p-3 rounded-[16px] bg-white border border-[#f3f4f6] shadow-2xs flex items-center gap-3 cursor-pointer hover:border-[#fed7aa] transition-colors"
                >
                  <div className="size-9 rounded-[10px] bg-[#fff7ed] text-[#f97316] flex items-center justify-center shrink-0">
                    <Building2 size={17} />
                  </div>
                  <div>
                    <h5 className="text-[12px] font-extrabold text-[#1e293b] leading-tight">Home Loans Branch</h5>
                    <p className="text-[10px] text-[#94a3b8] font-medium mt-0.5 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#f97316]" /> Online • Desk North
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => navigate('/handlers')}
                  className="p-3 rounded-[16px] bg-white border border-[#f3f4f6] shadow-2xs flex items-center gap-3 cursor-pointer hover:border-[#a7f3d0] transition-colors"
                >
                  <div className="size-9 rounded-[10px] bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0">
                    <ShieldCheck size={17} />
                  </div>
                  <div>
                    <h5 className="text-[12px] font-extrabold text-[#1e293b] leading-tight">Vehicle Loans Branch</h5>
                    <p className="text-[10px] text-[#94a3b8] font-medium mt-0.5 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#10b981]" /> Online • Desk West
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Operational Checklist with interactive toggles */}
            <div>
              <h4 className="text-[14px] font-extrabold text-[#1e293b] mb-3">
                Operational Checklist
              </h4>
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))}
                    className="flex items-center gap-2.5 p-2 rounded-[12px] hover:bg-[#f8f9fc] cursor-pointer transition-colors"
                  >
                    {todo.done ? (
                      <CheckSquare size={16} className="text-[#10b981] shrink-0" />
                    ) : (
                      <Square size={16} className="text-[#cbd5e1] shrink-0" />
                    )}
                    <span className={`text-[12px] font-medium leading-tight ${todo.done ? 'line-through text-[#94a3b8]' : 'text-[#1e293b]'}`}>
                      {todo.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="pt-4 mt-6 border-t border-[#f3f4f6] flex items-center justify-between text-[11px] text-[#94a3b8] font-medium">
            <span>DFA Engine v2.4</span>
            <span className="flex items-center gap-1 text-[#10b981]">
              <span className="size-1.5 rounded-full bg-[#10b981]" /> Online
            </span>
          </div>
        </aside>

      </div>
    </div>
  )
}
