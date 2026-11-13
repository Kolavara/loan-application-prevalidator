import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi, api, type Urgency } from '../api'
import {
  formatINR,
  validateCode,
  URGENCIES,
  ZONES,
} from '../utils'
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles, Send } from 'lucide-react'

type FormFields = {
  reporter_name: string
  contact: string
  application_code: string
  income: string
  amount: string
  zone: string
  urgency: string
  description: string
}

const EMPTY: FormFields = {
  reporter_name: '',
  contact: '',
  application_code: '',
  income: '',
  amount: '',
  zone: 'North',
  urgency: 'normal',
  description: '',
}

export default function Submission() {
  const navigate = useNavigate()
  const [fields, setFields] = useState<FormFields>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<any>(null)
  const [validating, setValidating] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle')
  const [submitMsg, setSubmitMsg] = useState<string>('')
  const [existingId, setExistingId] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { run: runValidate } = useApi(api.validate, false)

  const debouncedValidate = useCallback((f: FormFields) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setValidating(true)
    debounceRef.current = setTimeout(() => {
      runValidate({ ...f, urgency: f.urgency as Urgency }).then((res) => {
        if (res.ok) {
          setPreview(res.data)
          setErrors({})
        } else {
          setErrors(res.error?.errors || {})
          setPreview(res.data)
        }
        setValidating(false)
      })
    }, 250)
  }, [runValidate])

  const handleChange = (k: keyof FormFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.value
    const next = { ...fields, [k]: val }
    setFields(next)

    if (k === 'application_code') {
      const codeRes = validateCode(val)
      if (!codeRes.ok && val.length > 0) {
        setErrors((p) => ({ ...p, [k]: codeRes.error ?? '' }))
      } else {
        setErrors((p) => {
          const n = { ...p }
          delete n[k]
          return n
        })
      }
    }
    debouncedValidate(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('pending')
    setSubmitMsg('')
    setExistingId('')
    try {
      const res = await api.submitReport({ ...fields, urgency: fields.urgency as Urgency })
      if (res.ok) {
        setSubmitStatus('ok')
        setSubmitMsg(`Report ${res.data?.report_id || ''} created — Status: ${res.data?.status || ''} (Handler: ${res.data?.handler_name || res.data?.queue || 'Dispatched'})`)
      } else {
        setSubmitStatus('error')
        if (res.error?.status === 409) {
          setExistingId(res.error.existing_report_id || '')
          setSubmitMsg(`Duplicate application code already registered: ${res.error.existing_report_id || ''}. ${res.error.message || ''}`)
        } else if (res.error?.status === 422) {
          setSubmitMsg(`Application moved to correction queue: ${res.error.message || ''}`)
          setErrors(res.error?.errors || {})
        } else {
          setSubmitMsg(res.error?.message || 'Submission failed')
        }
      }
    } catch (err) {
      setSubmitStatus('error')
      setSubmitMsg(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  const isInvalidCode = fields.application_code && !validateCode(fields.application_code).ok
  const hasErrors = Object.keys(errors).length > 0 || isInvalidCode
  const requiredFilled =
    fields.reporter_name.trim() &&
    fields.contact.trim() &&
    fields.application_code.trim() &&
    fields.amount.trim() &&
    fields.description.trim()

  return (
    <div className="flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[#0d6efd] hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h2 className="text-[22px] font-extrabold text-[#1e293b]">Submit Application</h2>
          <p className="text-[12px] text-[#94a3b8] font-medium">
            Live DFA automata validation & routing policy pre-check as you type.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#eff6ff] text-[#0d6efd] text-[11px] font-bold">
          <Sparkles size={13} />
          <span>Table-Driven DFA q0–q11</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-[24px] border border-[#f3f4f6] shadow-xs">
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            
            {/* Applicant Name & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Applicant Name
                </label>
                <input
                  type="text"
                  value={fields.reporter_name}
                  onChange={handleChange('reporter_name')}
                  placeholder="e.g. Ramesh Kumar"
                  className={`w-full bg-[#f8f9fc] border ${errors.reporter_name ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'} rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                  required
                />
                {errors.reporter_name && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.reporter_name}</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Contact (Phone or Email)
                </label>
                <input
                  type="text"
                  value={fields.contact}
                  onChange={handleChange('contact')}
                  placeholder="e.g. 9876543210 or user@mail.com"
                  className={`w-full bg-[#f8f9fc] border ${errors.contact ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'} rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                  required
                />
                {errors.contact && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.contact}</p>
                )}
              </div>
            </div>

            {/* Application Code (DFA Verified) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                  Application Code (DFA Validated)
                </label>
                <span className="text-[10px] text-[#94a3b8] font-mono">Format: LOAN + [HVPE] + 6 Digits</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={fields.application_code}
                  onChange={handleChange('application_code')}
                  placeholder="e.g. LOANH123456"
                  className={`w-full bg-[#f8f9fc] font-mono uppercase tracking-wider border ${
                    isInvalidCode || errors.application_code ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'
                  } rounded-[12px] px-3.5 py-2.5 text-[13px] font-bold text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                  required
                />
                {fields.application_code && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {!isInvalidCode ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10b981] bg-[#ecfdf5] px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Accepted (q11)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={12} /> Invalid Trap
                      </span>
                    )}
                  </div>
                )}
              </div>
              {errors.application_code && (
                <p className="text-[11px] text-red-500 font-medium mt-1">{errors.application_code}</p>
              )}
            </div>

            {/* Income & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Annual Income (INR)
                </label>
                <input
                  type="number"
                  value={fields.income}
                  onChange={handleChange('income')}
                  placeholder="e.g. 1200000"
                  className={`w-full bg-[#f8f9fc] border ${errors.income ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'} rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                  required
                />
                {errors.income && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.income}</p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Requested Amount (INR)
                </label>
                <input
                  type="number"
                  value={fields.amount}
                  onChange={handleChange('amount')}
                  placeholder="e.g. 4500000"
                  className={`w-full bg-[#f8f9fc] border ${errors.amount ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'} rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                  required
                />
                {errors.amount && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">{errors.amount}</p>
                )}
              </div>
            </div>

            {/* Zone & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Zone
                </label>
                <select
                  value={fields.zone}
                  onChange={handleChange('zone')}
                  className="w-full bg-[#f8f9fc] border border-[#e2e8f0] rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all cursor-pointer"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                  <option value="Metropolitan">Metropolitan (Trigger fallback)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                  Urgency Level
                </label>
                <select
                  value={fields.urgency}
                  onChange={handleChange('urgency')}
                  className="w-full bg-[#f8f9fc] border border-[#e2e8f0] rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all cursor-pointer"
                >
                  {URGENCIES.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block mb-1.5">
                Loan Description & Purpose
              </label>
              <textarea
                value={fields.description}
                onChange={handleChange('description')}
                placeholder="Describe the loan purpose (e.g. Purchase of a residential 3BHK flat in north sector)..."
                rows={3}
                className={`w-full bg-[#f8f9fc] border ${errors.description ? 'border-red-400 ring-2 ring-red-100' : 'border-[#e2e8f0]'} rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium text-[#1e293b] focus:bg-white focus:border-[#0d6efd] focus:outline-hidden transition-all`}
                required
              />
              {errors.description && (
                <p className="text-[11px] text-red-500 font-medium mt-1">{errors.description}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitStatus === 'pending' || hasErrors || !requiredFilled}
                className="w-full sm:flex-1 py-3 px-6 rounded-[12px] bg-[#0d6efd] text-white font-bold text-[13px] shadow-lg shadow-[#0d6efd]/20 hover:bg-[#0b5ed7] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send size={15} />
                {submitStatus === 'pending' ? 'Dispatching...' : 'Validate & Dispatch Application'}
              </button>
              <button
                type="button"
                onClick={() => setFields(EMPTY)}
                className="w-full sm:w-auto py-3 px-6 rounded-[12px] bg-[#f8f9fc] border border-[#e2e8f0] text-[#64748b] hover:text-[#1e293b] font-bold text-[13px] hover:bg-white transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Right Preview Slip: 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Submission Result Alerts */}
          {submitStatus === 'ok' && (
            <div className="p-4 rounded-[20px] bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46]">
              <div className="flex items-center gap-2 font-extrabold text-[14px] mb-1">
                <CheckCircle2 size={16} className="text-[#10b981]" /> Application Dispatched
              </div>
              <p className="text-[12px] leading-relaxed">{submitMsg}</p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 rounded-[20px] bg-red-50 border border-red-200 text-red-800">
              <div className="flex items-center gap-2 font-extrabold text-[14px] mb-1">
                <AlertTriangle size={16} className="text-red-600" /> Dispatch Blocked
              </div>
              <p className="text-[12px] leading-relaxed">{submitMsg}</p>
              {existingId && (
                <p className="text-[11px] mt-2 font-semibold text-red-700">
                  Tip: Existing case ID {existingId} has been flagged for audit.
                </p>
              )}
            </div>
          )}

          {/* Live Validation Slip */}
          <div className="bg-white p-6 rounded-[24px] border border-[#f3f4f6] shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#f3f4f6] mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0d6efd]" />
                <h3 className="text-[15px] font-extrabold text-[#1e293b]">Live Validation Slip</h3>
              </div>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                validating ? 'bg-[#fff7ed] text-[#f97316]' : 'bg-[#eff6ff] text-[#0d6efd]'
              }`}>
                {validating ? 'Calculating...' : 'Real-Time'}
              </span>
            </div>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between items-center">
                <span className="text-[#64748b] font-medium">DFA Code Acceptance</span>
                <span className={`font-mono font-bold ${
                  preview?.valid ? 'text-[#10b981]' : fields.application_code ? 'text-red-500' : 'text-[#94a3b8]'
                }`}>
                  {preview?.valid ? 'ACCEPTED (q11)' : fields.application_code ? 'DEAD TRAP' : 'Awaiting Input'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#64748b] font-medium">Inferred Category</span>
                <span className="font-extrabold text-[#1e293b] bg-[#f8f9fc] px-2.5 py-0.5 rounded-[8px]">
                  {preview?.category || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#64748b] font-medium">Amount Band</span>
                <span className="font-semibold text-[#0d6efd]">
                  {preview?.band || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#64748b] font-medium">Zone Dispatched</span>
                <span className="font-semibold text-[#1e293b]">
                  {preview?.zone_used || fields.zone || '—'}
                  {preview?.zone_fallback && (
                    <span className="ml-1 text-[11px] text-[#f97316] font-bold">
                      (Fallback: {preview.zone_fallback})
                    </span>
                  )}
                </span>
              </div>

              <div className="border-t border-[#f3f4f6] pt-3 flex justify-between items-center">
                <span className="text-[#64748b] font-medium">Annual Income</span>
                <span className="font-mono font-bold text-[#1e293b]">
                  {formatINR(fields.income)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#64748b] font-medium">Loan Requested</span>
                <span className="font-mono font-extrabold text-[#0d6efd]">
                  {formatINR(fields.amount)}
                </span>
              </div>

              {preview?.class_note && (
                <div className="p-3 bg-[#fff7ed] rounded-[12px] border border-[#fed7aa] text-[11px] text-[#c2410c] font-medium leading-relaxed">
                  <strong>Conflict Note:</strong> {preview.class_note}
                </div>
              )}

              {Object.keys(errors).length > 0 && (
                <div className="p-3 bg-red-50 rounded-[12px] border border-red-200 text-[11px] text-red-700 font-medium">
                  <strong>Validation Errors:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {Object.entries(errors).map(([k, err]) => (
                      <li key={k}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
