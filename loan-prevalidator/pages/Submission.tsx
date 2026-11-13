import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../api'
import { api } from '../api'
import {
  escapeHtml,
  formatINR,
  validateCode,
  URGENCIES,
  ZONES,
  statusColor,
  priorityColor,
} from '../utils'

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
  zone: '',
  urgency: 'normal',
  description: '',
}

const FIELD_LABELS: Record<string, string> = {
  reporter_name: 'Reporter name',
  contact: 'Contact (phone/email)',
  application_code: 'Application code',
  income: 'Annual income (INR)',
  amount: 'Loan amount (INR)',
  zone: 'Zone',
  urgency: 'Urgency',
  description: 'Description',
}

export default function Submission() {
  const navigate = useNavigate()
  const [fields, setFields] = useState<FormFields>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [valid, setValid] = useState<Record<string, boolean>>({})
  const [preview, setPreview] = useState<any>(null)
  const [validating, setValidating] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle')
  const [submitMsg, setSubmitMsg] = useState<string>('')
  const [existingId, setExistingId] = useState<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, error, loading, run: runValidate } = useApi(api.validate, false)

  useEffect(() => {
    if (!validating) return
    const fieldsForValidation = { ...fields }
    runValidate(fieldsForValidation).then((res) => {
      if (res.ok) {
        setPreview(res.data)
        setErrors({})
        setValid({})
      } else {
        setErrors(res.error?.errors || {})
        setValid({})
        setPreview(res.data)
      }
      setValidating(false)
    })
  }, [data, error, validating, runValidate, fields])

  const debouncedValidate = useCallback((f: FormFields) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setValidating(true)
    debounceRef.current = setTimeout(() => {
      runValidate(f).then((res) => {
        if (res.ok) {
          setPreview(res.data)
          setErrors({})
          setValid({})
        } else {
          setErrors(res.error?.errors || {})
          setValid({})
          setPreview(res.data)
        }
        setValidating(false)
      })
    }, 250)
  }, [runValidate])

  const handleChange = (k: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFields((p) => ({ ...p, [k]: e.target.value }))
    const codeRes = k === 'application_code' ? validateCode(e.target.value) : { ok: true }
    if (k === 'application_code') {
      setValid((p) => ({ ...p, [k]: codeRes.ok }))
      if (!codeRes.ok) setErrors((p) => ({ ...p, [k]: codeRes.error }))
      else setErrors((p) => { const n = { ...p }; delete n[k]; return n })
    }
    debouncedValidate({ ...fields, [k]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('pending')
    setSubmitMsg('')
    setExistingId('')
    try {
      const res = await api.submitReport(fields)
      if (res.ok) {
        setSubmitStatus('ok')
        setSubmitMsg(`Report ${escapeHtml(res.data?.report_id || '')} created — ${escapeHtml(res.data?.status || '')}`)
      } else {
        setSubmitStatus('error')
        if (res.error?.status === 409) {
          setExistingId(res.error.existing_report_id || '')
          setSubmitMsg(`Duplicate report already exists: ${escapeHtml(res.error.existing_report_id || '')}. ${escapeHtml(res.error.message || '')}`)
        } else if (res.error?.status === 422) {
          setSubmitMsg(`Rejected (correction queue): ${escapeHtml(res.error.message || '')}`)
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

  const loadForCorrection = (report: any) => {
    setFields({
      reporter_name: report.reporter_name || '',
      contact: report.contact || '',
      application_code: report.application_code || '',
      income: String(report.income ?? ''),
      amount: String(report.amount ?? ''),
      zone: report.zone || '',
      urgency: report.urgency || 'normal',
      description: report.description || '',
    })
    navigate('/')
  }

  const isInvalidCode = fields.application_code && !validateCode(fields.application_code).ok
  const hasErrors = Object.keys(errors).length > 0 || isInvalidCode
  const requiredFilled =
    fields.reporter_name.trim() &&
    fields.contact.trim() &&
    fields.application_code.trim() &&
    fields.amount.trim() &&
    fields.description.trim()

  const category = preview?.category
  const band = preview?.band
  const zoneUsed = preview?.zone_used
  const zoneFallback = preview?.zone_fallback
  const classNote = preview?.class_note

  return (
    <div className="max-w-4xl mx-auto space-y-16">
      {/* Back / breadcrumb */}
      <div className="flex items-center gap-4 text-xs uppercase tracking-wider text-[var(--muted-fg)] font-semibold mb-2">
        <button
          onClick={() => navigate(-1)}
          className="text-[var(--accent)] hover:underline flex items-center gap-2"
        >
          <span>←</span> Back
        </button>
        <span aria-hidden="true">/</span>
        <span>Report submission</span>
      </div>

      <h2 className="mb-1">New report</h2>
      <p className="small mb-6">Enter the loan application details. Validation runs as you type and the preview slip updates live.</p>

      {/* Form */}
      <form noValidate onSubmit={handleSubmit} className="form-grid">
        <div className="col-span-2">
          <label htmlFor="reporter_name">{FIELD_LABELS.reporter_name}</label>
          <input
            id="reporter_name"
            name="reporter_name"
            className={`w-full ${errors.reporter_name || valid.reporter_name === false ? 'invalid' : ''}`}
            value={fields.reporter_name}
            onChange={handleChange('reporter_name')}
            placeholder="Full name"
            required
          />
          {errors.reporter_name && <span className="field-error">{escapeHtml(errors.reporter_name)}</span>}
        </div>

        <div className="col-span-2">
          <label htmlFor="contact">{FIELD_LABELS.contact}</label>
          <input
            id="contact"
            name="contact"
            className={`w-full ${errors.contact || valid.contact === false ? 'invalid' : ''}`}
            value={fields.contact}
            onChange={handleChange('contact')}
            placeholder="Phone or email"
            required
          />
          {errors.contact && <span className="field-error">{escapeHtml(errors.contact)}</span>}
        </div>

        <div>
          <label htmlFor="application_code">{FIELD_LABELS.application_code}</label>
          <div className="flex items-end gap-2">
            <input
              id="application_code"
              name="application_code"
              className={`flex-1 monospace ${isInvalidCode || errors.application_code || valid.application_code === false ? 'invalid' : ''} uppercase`}
              value={fields.application_code}
              onChange={handleChange('application_code')}
              placeholder="LOANH123456"
              required
              spellCheck={false}
            />
            <span className="validity-mark">{isInvalidCode ? 'invalid' : fields.application_code ? 'ok' : '—'}</span>
          </div>
          {errors.application_code && <span className="field-error">{escapeHtml(errors.application_code)}</span>}
          {isInvalidCode && !errors.application_code && <span className="field-error">Use LOAN + H/V/P/E + 6 digits</span>}
        </div>

        <div>
          <label htmlFor="income">{FIELD_LABELS.income}</label>
          <input
            id="income"
            name="income"
            type="number"
            className={`w-full text-right ${errors.income || valid.income === false ? 'invalid' : ''} income`}
            value={fields.income}
            onChange={handleChange('income')}
            placeholder="e.g. 1250000"
            required
          />
          {errors.income && <span className="field-error">{escapeHtml(errors.income)}</span>}
        </div>

        <div>
          <label htmlFor="amount">{FIELD_LABELS.amount}</label>
          <input
            id="amount"
            name="amount"
            type="number"
            className={`w-full text-right ${errors.amount || valid.amount === false ? 'invalid' : ''} amount`}
            value={fields.amount}
            onChange={handleChange('amount')}
            placeholder="e.g. 500000"
            required
          />
          {errors.amount && <span className="field-error">{escapeHtml(errors.amount)}</span>}
        </div>

        <div className="col-span-2">
          <label htmlFor="zone">{FIELD_LABELS.zone}</label>
          <div className="flex gap-2">
            <input
              id="zone"
              name="zone"
              className="flex-1"
              value={fields.zone}
              onChange={handleChange('zone')}
              placeholder="e.g. North"
              list="zone-list"
            />
            <datalist id="zone-list">
              {ZONES.map((z) => <option key={z} value={z} />)}
            </datalist>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const z = fields.zone.trim()
                if (!ZONES.includes(z) && z) {
                  setFields((p) => ({ ...p, zone: z }))
                }
              }}
            >
              Add
            </button>
          </div>
          {errors.zone && <span className="field-error">{escapeHtml(errors.zone)}</span>}
          <p className="small mt-1">Suggestions: {ZONES.join(', ')}. Unknown zones are allowed.</p>
        </div>

        <div>
          <label htmlFor="urgency">{FIELD_LABELS.urgency}</label>
          <select
            id="urgency"
            name="urgency"
            className="w-full"
            value={fields.urgency}
            onChange={handleChange('urgency')}
          >
            {URGENCIES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label htmlFor="description">{FIELD_LABELS.description}</label>
          <textarea
            id="description"
            name="description"
            value={fields.description}
            onChange={handleChange('description')}
            placeholder="Purpose of loan and any relevant notes"
            required
          />
          {errors.description && <span className="field-error">{escapeHtml(errors.description)}</span>}
        </div>

        <div className="col-span-2 flex gap-4 mt-4">
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={submitStatus === 'pending' || hasErrors || !requiredFilled}
          >
            {submitStatus === 'pending' ? 'Submitting…' : 'Submit report'}
          </button>
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={() => setFields(EMPTY)}
            disabled={submitStatus === 'pending'}
          >
            Clear
          </button>
        </div>
      </form>

      {/* Submit result */}
      {submitStatus === 'ok' && (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title">Submitted</h3>
          </div>
          <div className="slip">
            <div className="slip-head">Report lodged</div>
            <div className="slip-row"><span className="slip-label">Report ID</span><span className="mono">{escapeHtml(String(submitMsg))}</span></div>
            <p className="slip-note">The report has been dispatched. Use the Dashboard to track its status.</p>
          </div>
        </section>
      )}

      {submitStatus === 'error' && (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title" style={{ color: 'var(--status-rejected)' }}>Result</h3>
          </div>
          <div className="slip" style={{ borderColor: 'var(--status-rejected)' }}>
            <div className="slip-head" style={{ color: 'var(--status-rejected)' }}>{existingId ? `Duplicate — ${existingId}` : 'Rejected'}</div>
            <div className="slip-row"><span className="slip-label">Message</span><span>{escapeHtml(submitMsg)}</span></div>
            {existingId && (
              <p className="slip-note">A report with this application code already exists. Open it from the Dashboard to correct and resubmit.</p>
            )}
          </div>
        </section>
      )}

      {/* Preview slip */}
      {preview || validating ? (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title">Live validation preview</h3>
            <span className="small">{validating ? 'Validating…' : 'Ready'}</span>
          </div>
          <div className="slip">
            <div className="slip-head">Validation slip</div>
            <div className="slip-row"><span className="slip-label">Valid</span><span>{preview ? String(preview.valid) : '—'}</span></div>
            {preview?.category && <div className="slip-row"><span className="slip-label">Category</span><span>{escapeHtml(preview.category)}</span></div>}
            {preview?.band && <div className="slip-row"><span className="slip-label">Amount band</span><span>{escapeHtml(preview.band)}</span></div>}
            {preview?.zone_used && (
              <div className="slip-row"><span className="slip-label">Zone used</span><span>{escapeHtml(preview.zone_used)}</span></div>
            )}
            {preview?.zone_fallback && (
              <div className="slip-row"><span className="slip-label">Zone fallback</span><span className="mono">{escapeHtml(preview.zone_fallback)}</span></div>
            )}
            {preview?.class_note && (
              <div className="slip-row"><span className="slip-label">Classification note</span><span>{escapeHtml(preview.class_note)}</span></div>
            )}
            <div className="slip-divider"></div>
            <div className="slip-row"><span className="slip-label">Income</span><span className="money text-right">{formatINR(fields.income)}</span></div>
            <div className="slip-row"><span className="slip-label">Amount</span><span className="money text-right">{formatINR(fields.amount)}</span></div>
            {Object.keys(errors || {}).length > 0 && (
              <div className="slip-row"><span className="slip-label">Errors</span><span style={{ color: 'var(--status-rejected)' }}>{Object.values(errors).join('; ')}</span></div>
            )}
            {preview?.zone_fallback && (
              <p className="slip-note">Zone "{escapeHtml(fields.zone)}" was not recognised — fallback zone {escapeHtml(String(preview.zone_fallback))} used.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
