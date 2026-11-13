import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useApi, api } from '../api'
import { formatINR } from '../utils'
import { 
  ArrowRight, 
  Flame, 
  Tv, 
  FileCheck, 
  HelpCircle, 
  ChevronRight,
  BookOpen,
  Film,
  Building,
  Car
} from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
  const { searchVal } = useOutletContext<{ searchVal?: string }>() || {}
  const { data: reportsData } = useApi(api.listReports, true)
  const [inputCode, setInputCode] = useState('')

  const counts = reportsData?.counts || { total: 40, Pending: 8, Assigned: 24, 'In Progress': 8, Resolved: 24 }
  const allReports = reportsData?.reports || []

  // Filter reports if search value provided
  const filteredReports = searchVal
    ? allReports.filter(r => 
        r.application_code?.toLowerCase().includes(searchVal.toLowerCase()) ||
        r.reporter_name?.toLowerCase().includes(searchVal.toLowerCase()) ||
        r.report_id?.toLowerCase().includes(searchVal.toLowerCase())
      )
    : allReports

  // Interactive Bar Chart Data matching Screenshot
  const [hoveredBar, setHoveredBar] = useState<number | null>(2) // default to Wed hovered

  const bars = [
    { label: 'Mon', height: '80%', color: '#f97316', duration: '3h 10m' },
    { label: 'Tue', height: '45%', color: '#f1f5f9', duration: '1h 50m' },
    { label: 'Wed', height: '65%', color: '#0d6efd', duration: '3h 40m', highlight: true, tooltipTitle: '3h 40m', tooltipSub: 'Peak load' },
    { label: 'Thu', height: '40%', color: '#f1f5f9', duration: '1h 30m' },
    { label: 'Fri', height: '60%', color: '#10b981', duration: '2h 45m' },
  ]

  const handleQuickLookup = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputCode.trim()) {
      navigate('/submit')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. TOP SECTION: STATS ROW (1/3) + LARGE BAR CHART (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Stats Row: 3 Vertical Icon-Left Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3.5">
          {/* Card 1: Total Applications */}
          <div className="bg-white p-4.5 rounded-[24px] border border-[#f3f4f6] flex items-center gap-4 shadow-xs hover:shadow-md transition-all duration-300">
            <div className="size-11 rounded-[14px] bg-[#fdf2f8] text-[#ec4899] flex items-center justify-center shrink-0">
              <Tv size={20} />
            </div>
            <div>
              <h3 className="text-[22px] font-extrabold text-[#1e293b] leading-tight">
                {counts.total || 40}
              </h3>
              <p className="text-[12px] font-semibold text-[#64748b] mt-0.5">Total Applications</p>
            </div>
          </div>

          {/* Card 2: Active Cases */}
          <div className="bg-white p-4.5 rounded-[24px] border border-[#f3f4f6] flex items-center gap-4 shadow-xs hover:shadow-md transition-all duration-300">
            <div className="size-11 rounded-[14px] bg-[#fff7ed] text-[#f97316] flex items-center justify-center shrink-0">
              <FileCheck size={20} />
            </div>
            <div>
              <h3 className="text-[22px] font-extrabold text-[#1e293b] leading-tight">
                {counts.Assigned || 24}
              </h3>
              <p className="text-[12px] font-semibold text-[#64748b] mt-0.5">Active In-Dispatch</p>
            </div>
          </div>

          {/* Card 3: Pending Reviews */}
          <div className="bg-white p-4.5 rounded-[24px] border border-[#f3f4f6] flex items-center gap-4 shadow-xs hover:shadow-md transition-all duration-300">
            <div className="size-11 rounded-[14px] bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0">
              <HelpCircle size={20} />
            </div>
            <div>
              <h3 className="text-[22px] font-extrabold text-[#1e293b] leading-tight">
                {counts.Pending || 8}
              </h3>
              <p className="text-[12px] font-semibold text-[#64748b] mt-0.5">Pending Pre-Validation</p>
            </div>
          </div>
        </div>

        {/* Right Large Chart Area: Application Flow (8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[24px] border border-[#f3f4f6] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-extrabold text-[#1e293b]">Processing Timeline</h3>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#f97316]">
              <span className="size-2 rounded-full bg-[#f97316]" />
              Active Throughput
            </div>
          </div>

          {/* Custom CSS Bar Chart with 14px radius, tooltips & hover states */}
          <div className="h-48 flex items-end justify-around gap-3 pt-12 pb-2 px-2">
            {bars.map((bar, idx) => {
              const isHovered = hoveredBar === idx
              const showTooltip = bar.highlight || isHovered
              return (
                <div 
                  key={bar.label} 
                  className="flex-1 max-w-[54px] flex flex-col items-center relative h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Floating Tooltip at top */}
                  {showTooltip && (
                    <div className="absolute -top-11 bg-white px-3 py-1 rounded-[10px] shadow-lg border border-[#f1f5f9] text-center z-10 transition-all duration-300 -translate-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#1e293b]">
                        <Flame size={12} className="text-[#f97316] fill-[#f97316]" />
                        <span>{bar.tooltipTitle || bar.duration}</span>
                      </div>
                      <span className="text-[9px] font-medium text-[#94a3b8] block -mt-0.5">
                        {bar.tooltipSub || 'Active'}
                      </span>
                    </div>
                  )}

                  {/* Bar Div with 14px border radius */}
                  <div 
                    className="w-full rounded-[14px] transition-all duration-300 ease-in-out hover:brightness-105"
                    style={{ 
                      height: bar.height, 
                      backgroundColor: bar.color 
                    }}
                  />
                  <span className={`text-[12px] font-bold mt-2.5 ${isHovered ? 'text-[#1e293b]' : 'text-[#94a3b8]'}`}>
                    {bar.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* 2. SECOND SECTION: CATEGORY GRID (3 COLUMNS) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#1e293b]">Active Loan Portfolios</h3>
            <p className="text-[12px] text-[#94a3b8] font-medium">Underwriting branches and dispatch policies currently operational</p>
          </div>
          <button 
            onClick={() => navigate('/routing')}
            className="text-[12px] font-bold text-[#64748b] bg-white border border-[#f3f4f6] px-3.5 py-1.5 rounded-[10px] shadow-2xs hover:text-[#0d6efd] transition-colors cursor-pointer"
          >
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Quick Code Search Card (24px rounded card, #fff7ed, abstract blob SVG, embedded CTA) */}
          <div className="relative overflow-hidden p-6 rounded-[24px] bg-[#fff7ed] border border-[#fed7aa]/50 flex flex-col justify-between shadow-xs min-h-[190px]">
            {/* Abstract Organic Blob SVG */}
            <svg 
              className="absolute -right-6 -top-6 size-40 text-[#f97316]/20 pointer-events-none" 
              viewBox="0 0 200 200" 
              fill="currentColor"
            >
              <path d="M44.7,-64.4C58.8,-55.8,71.7,-43.6,77.5,-28.5C83.3,-13.4,82,4.6,76.2,20.8C70.4,36.9,60.2,51.3,46.7,61.9C33.2,72.5,16.6,79.4,-0.4,79.9C-17.4,80.5,-34.7,74.7,-48.9,64.2C-63,53.7,-74,38.5,-77.9,21.8C-81.8,5.1,-78.6,-13.1,-71.2,-28.9C-63.7,-44.7,-52.1,-58.2,-38.3,-66.9C-24.5,-75.7,-8.4,-79.8,4.9,-77.5C18.2,-75.2,30.6,-73,44.7,-64.4Z" transform="translate(100 100)" />
            </svg>

            <div>
              <div className="size-9 rounded-[10px] bg-white shadow-2xs text-[#0d6efd] flex items-center justify-center mb-3">
                <BookOpen size={17} />
              </div>
              <h4 className="text-[16px] font-extrabold text-[#1e293b]">Application Code</h4>
              <p className="text-[12px] text-[#94a3b8] font-medium mt-0.5">Enter code to inspect live DFA trace</p>
            </div>

            {/* White input field wrapper with embedded CTA button */}
            <form onSubmit={handleQuickLookup} className="relative mt-4">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="LOANH123456..."
                className="w-full bg-white pr-12 pl-3.5 py-2.5 rounded-[14px] border border-white text-[12px] font-semibold placeholder-[#cbd5e1] focus:outline-hidden focus:ring-2 focus:ring-[#f97316]/30 shadow-2xs"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 size-8 rounded-[10px] bg-[#f97316] text-white flex items-center justify-center hover:bg-[#ea580c] transition-colors shadow-xs cursor-pointer"
              >
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Card 2: Home Loans Card */}
          <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-300 min-h-[190px]">
            <div>
              <div className="size-9 rounded-[10px] bg-[#eff6ff] text-[#0d6efd] flex items-center justify-center mb-3">
                <Building size={17} />
              </div>
              <h4 className="text-[15px] font-extrabold text-[#1e293b] leading-snug">
                Home Loans: Standard & Senior
              </h4>
            </div>

            <div className="mt-4">
              <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden mb-3">
                <div className="w-3/5 h-full bg-[#0d6efd] rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
                <span className="flex items-center gap-1">
                  <Film size={12} /> 10x Annual Income Max
                </span>
                <span className="flex items-center gap-1 text-[#94a3b8]">
                  ₹1 Cr Ceiling
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Vehicle Loans Card */}
          <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-300 min-h-[190px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-[10px] bg-[#faf5ff] text-[#a855f7] flex items-center justify-center">
                  <Car size={17} />
                </div>
                <span className="size-2 rounded-full bg-[#ec4899]" />
              </div>
              <h4 className="text-[15px] font-extrabold text-[#1e293b] leading-snug">
                Vehicle & Personal: Instant Dispatch
              </h4>
            </div>

            <div className="mt-4">
              <div className="w-full h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden mb-3">
                <div className="w-4/5 h-full bg-[#a855f7] rounded-full" />
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
                <span className="flex items-center gap-1">
                  <Film size={12} /> 5x Income · Rapid Track
                </span>
                <span className="flex items-center gap-1 text-[#94a3b8]">
                  ₹2 Cr Ceiling
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. THIRD SECTION: RECENT APPLICATIONS TABLE (Full Width) */}
      <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-extrabold text-[#1e293b]">Recent Applications</h3>
          <span 
            onClick={() => navigate('/routing')}
            className="text-[12px] font-bold text-[#0d6efd] cursor-pointer hover:underline"
          >
            View routing table →
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[#94a3b8] text-[11px] uppercase tracking-wider font-bold">
                <th className="pb-3 font-bold">Report ID</th>
                <th className="pb-3 font-bold">Applicant</th>
                <th className="pb-3 font-bold">Amount</th>
                <th className="pb-3 font-bold text-center">Category</th>
                <th className="pb-3 font-bold text-center">Status</th>
                <th className="pb-3 font-bold text-right">Zone</th>
                <th className="pb-3 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8f9fc]">
              {filteredReports.slice(0, 6).map((item, idx) => (
                <tr key={item.report_id || idx} className="hover:bg-[#f8f9fc] transition-colors">
                  <td className="py-3.5 font-mono font-bold text-[#0d6efd]">
                    {item.report_id || `APP-${1000 + idx}`}
                  </td>
                  <td className="py-3.5 font-bold text-[#1e293b]">
                    {item.reporter_name || `Applicant ${idx + 1}`}
                  </td>
                  <td className="py-3.5 font-mono font-semibold text-[#1e293b]">
                    {formatINR(item.amount)}
                  </td>
                  <td className="py-3.5 text-center">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#f1f5f9] text-[#475569]">
                      {item.category || 'Home'}
                    </span>
                  </td>
                  <td className="py-3.5 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      item.status === 'Resolved' ? 'bg-[#ecfdf5] text-[#10b981]' :
                      item.status === 'Assigned' ? 'bg-[#eff6ff] text-[#0d6efd]' :
                      item.status === 'In Progress' ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#f1f5f9] text-[#64748b]'
                    }`}>
                      {item.status || 'Pending'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-medium text-[#64748b]">
                    {item.zone || 'Central'}
                  </td>
                  <td className="py-3.5 text-right">
                    <button 
                      onClick={() => navigate('/routing')}
                      className="size-7 rounded-full bg-[#f8f9fc] hover:bg-[#eff6ff] text-[#64748b] hover:text-[#0d6efd] inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
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
