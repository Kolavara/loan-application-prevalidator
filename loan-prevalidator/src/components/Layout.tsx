import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Table, BarChart3, RefreshCw, Compass } from 'lucide-react'
import { api } from '../api'

const NAV = [
  { path: '/submit', label: 'Submit', icon: FileText },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/handlers', label: 'Handlers', icon: Users },
  { path: '/routing', label: 'Routing', icon: Table },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path || (path !== '/submit' && location.pathname.startsWith(path))

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await api.demoSeed()
      window.location.reload()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased">
      {/* Top bar with Pocket Studio style */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-6 md:px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--plot)] text-white shadow-sm">
              <Compass size={16} />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-semibold tracking-[-0.02em]">Loan</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--plot)] font-semibold px-1.5 py-0.5 rounded bg-[var(--blue-1)] border border-[var(--blue-2)]">
                Pre-Validator
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 ml-4">
            {NAV.map((tab) => (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors ${
                  isActive(tab.path)
                    ? 'bg-[var(--well)] text-[var(--ink)] font-semibold shadow-xs'
                    : 'text-[var(--mid)] hover:text-[var(--ink)] hover:bg-[var(--well)]/60'
                }`}
              >
                <tab.icon size={15} className={isActive(tab.path) ? 'text-[var(--plot)]' : 'text-[var(--muted)]'} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--mid)] hover:text-[var(--ink)] hover:border-[var(--muted)] transition-colors shadow-xs disabled:opacity-50"
            disabled={seeding}
            onClick={handleSeed}
          >
            <RefreshCw size={13} className={seeding ? 'animate-spin text-[var(--plot)]' : ''} />
            <span>{seeding ? 'Seeding...' : 'Demo Seed'}</span>
          </button>

          <a
            href="http://127.0.0.1:5174"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex h-9 items-center gap-1.5 rounded-lg bg-[var(--blue-1)] border border-[var(--blue-2)] px-3 text-[12px] font-mono text-[var(--blue-5)] hover:bg-[var(--blue-2)] transition-colors"
          >
            <span className="size-1.5 rounded-full bg-[var(--plot)] animate-pulse" />
            Pencil Demo (5174)
          </a>

          <button
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--mid)] hover:text-[var(--ink)] md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className="flex flex-col gap-1 w-4">
              <span className="h-0.5 bg-[var(--ink)] rounded" />
              <span className="h-0.5 bg-[var(--ink)] rounded" />
              <span className="h-0.5 bg-[var(--ink)] rounded" />
            </span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-row relative min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 border-r border-[var(--line)] bg-[var(--card)]">
          <div className="p-4 space-y-1">
            <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Operations
            </p>
            {NAV.map((n) => {
              const Icon = n.icon
              const active = isActive(n.path)
              return (
                <button
                  key={n.path}
                  onClick={() => { navigate(n.path); setOpen(false) }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--blue-1)] text-[var(--blue-5)] font-semibold'
                      : 'text-[var(--mid)] hover:bg-[var(--well)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-[var(--plot)]' : 'text-[var(--muted)]'} />
                  {n.label}
                </button>
              )
            })}
          </div>

          <div className="mt-8 p-4 border-t border-[var(--line)]">
            <p className="px-3 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Architecture
            </p>
            <div className="mt-2 space-y-1.5 px-3 font-mono text-[11px] text-[var(--mid)]">
              <div className="flex items-center justify-between">
                <span>DFA:</span>
                <span className="text-[var(--positive)] font-semibold">12 States</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Routing:</span>
                <span className="text-[var(--plot)] font-semibold">60 Matrix</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Handlers:</span>
                <span className="text-[var(--ink)] font-semibold">40 Agents</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8 bg-[var(--paper)]">
          <Outlet context={{ navigate }} />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden border-t border-[var(--line)] bg-[var(--card)] fixed bottom-0 left-0 right-0 z-30 shadow-lg">
        <div className="flex justify-around py-2">
          {NAV.map((n) => {
            const Icon = n.icon
            const active = isActive(n.path)
            return (
              <button
                key={n.path}
                onClick={() => { navigate(n.path) }}
                className="flex flex-col items-center gap-1 text-[11px] font-medium py-1 px-2"
              >
                <Icon size={18} className={active ? 'text-[var(--plot)]' : 'text-[var(--muted)]'} />
                <span className={active ? 'text-[var(--plot)] font-semibold' : 'text-[var(--muted)]'}>{n.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      {open && (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--card)] border-r border-[var(--line)] shadow-xl transform translate-x-0 transition-transform md:hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
            <h2 className="text-sm font-semibold">Navigation</h2>
            <button onClick={() => setOpen(false)} className="text-[12px] text-[var(--mid)]">Close</button>
          </div>
          <div className="p-3 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon
              const active = isActive(n.path)
              return (
                <button
                  key={n.path}
                  onClick={() => { navigate(n.path); setOpen(false) }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active ? 'bg-[var(--blue-1)] text-[var(--blue-5)] font-semibold' : 'text-[var(--mid)] hover:bg-[var(--well)]'
                  }`}
                >
                  <Icon size={16} />
                  {n.label}
                </button>
              )
            })}
          </div>
        </aside>
      )}
    </div>
  )
}
