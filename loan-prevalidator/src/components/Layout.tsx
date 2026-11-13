import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, Table, BarChart3, RefreshCw } from 'lucide-react'
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
    <div className="flex flex-col min-h-screen">
      {/* Top nav */}
      <header className="border-b border-solid border-[var(--border)] bg-[var(--surface)] sticky top-0 z-20">
        <div className="flex items-center justify-between gap-12 px-6 py-4">
          <div className="flex items-center gap-8">
            <h1 className="text-[17px] tracking-tighter">Loan Pre-Validator</h1>
            <nav className="hidden md:flex items-center gap-16 text-xs uppercase tracking-wider text-[var(--muted-fg)] font-semibold">
              {NAV.map((n) => (
                <a
                  key={n.path}
                  href={n.path}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(n.path)
                    setOpen(false)
                  }}
                  className={`border-b-2 border-transparent pb-3 transition-colors hover:text-[var(--ink)] ${isActive(n.path) ? 'border-[var(--accent)] text-[var(--ink)]' : ''}`}
                >
                  {n.label}
                </a>
              ))}
              <a href="#" onClick={(e) => { e.preventDefault(); handleSeed() }} className="text-[var(--accent)] hover:underline">
                {seeding ? 'Seeding...' : 'Demo seed'}
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <button
              className="btn btn-sm btn-ghost hidden md:flex"
              disabled={seeding}
              onClick={handleSeed}
            >
              <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{seeding ? 'Seeding...' : 'Demo Seed'}</span>
            </button>
            <button
              className="btn btn-sm btn-ghost md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Open navigation"
            >
              <span className="flex flex-col gap-1.5" style={{ width: 20 }}>
                <span className="h-1 bg-[var(--ink)] rounded"></span>
                <span className="h-1 bg-[var(--ink)] rounded"></span>
                <span className="h-1 bg-[var(--ink)] rounded"></span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-row relative min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <nav className="border-r border-solid border-[var(--border)] bg-[var(--surface)] w-64 h-full flex-shrink-0">
            <ul className="py-4 space-y-1">
              {NAV.map((n) => {
                const Icon = n.icon
                return (
                  <li key={n.path}>
                    <button
                      onClick={() => { navigate(n.path); setOpen(false) }}
                      className={`flex w-full items-center gap-10 px-5 py-3 text-sm font-semibold transition-colors ${isActive(n.path) ? 'bg-[rgba(31,77,58,0.08)] text-[var(--accent)] border-r-2 border-[var(--accent)]' : 'hover:bg-[#f2ede2] text-[var(--muted-fg)] hover:text-[var(--ink)]'}`}
                    >
                      <Icon size={16} />
                      {n.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet context={{ navigate }} />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden border-t border-solid border-[var(--border)] bg-[var(--surface)] fixed bottom-0 left-0 right-0 z-30">
        <div className="flex justify-around py-2">
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.path}
                onClick={() => { navigate(n.path) }}
                className="flex flex-col items-center gap-1 text-xs font-semibold"
              >
                <Icon size={18} />
                <span className={isActive(n.path) ? 'text-[var(--accent)]' : 'text-[var(--muted-fg)]'}>{n.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Mobile sidebar overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      {open && (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--surface)] border-r border-solid border-[var(--border)] shadow-lg transform translate-x-0 transition-transform duration-140">
          <div className="flex items-center justify-between px-5 py-4 border-b border-solid border-[var(--border)]">
            <h2 className="text-sm font-semibold">Navigation</h2>
            <button onClick={() => setOpen(false)} className="btn btn-xs btn-ghost">Close</button>
          </div>
          <ul className="py-3 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <li key={n.path}>
                  <button
                    onClick={() => { navigate(n.path); setOpen(false) }}
                    className={`flex w-full items-center gap-10 px-5 py-3 text-sm font-semibold transition-colors ${isActive(n.path) ? 'bg-[rgba(31,77,58,0.08)] text-[var(--accent)]' : 'hover:bg-[#f2ede2] text-[var(--muted-fg)] hover:text-[var(--ink)]'}`}
                  >
                    <Icon size={16} />
                    {n.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
      )}
    </div>
  )
}
