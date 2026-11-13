# Loan Application Pre-Validator — Frontend

Responsive React (Vite) frontend for the Flask + SQLite REST API running at `http://127.0.0.1:5000`. A Vite dev proxy routes `/api` to the backend.

## Stack
- React 19 + TypeScript + Vite
- React Router (5 routes)
- Recharts (charts)
- Plain CSS (design tokens, no framework UI kit)
- lucide-react (icons)

## Folder structure
```
src/
  api.ts          # central fetch wrapper + useApi hook (loading/error/auto-refresh)
  utils.ts        # formatters, escaper, code validator
  components/
    Layout.tsx    # top nav + desktop sidebar / mobile bottom tab bar
  pages/
    Submission.tsx   (a) Report submission with debounced /api/validate + slip preview
    Dashboard.tsx    (b) User dashboard: stat tiles, search, table, detail panel, correct & resubmit
    Handler.tsx      (c) Handler desk: selector, assigned reports, Start/Resolve, availability, capacity
    Routing.tsx      (d) Routing desk: routing table, handler load, queues, escalations/overrides, process queue
    Analytics.tsx    (e) Analytics: zone/category/status/priority charts + KPIs
  main.tsx
  index.css       # design-system tokens (paper/ink/accent, dark theme)
```

## Run steps
```bash
cd loan-prevalidator
npm install
npm run dev
```
Open the printed local URL (default `http://localhost:5173`). The dev server proxies `/api` to `http://127.0.0.1:5000`, so the backend must be running.

Production build:
```bash
npm run build   # tsc -b && vite build
npm run preview
```

## Design notes
- Paper background `#f6f3ec`, ink `#1d1b16`, single accent `#1f4d3a`, dark theme via the same CSS tokens (`prefers-color-shape: dark`).
- Serif headings (Source Serif 4), IBM Plex Sans UI, IBM Plex Mono for codes/IDs/amounts.
- INR with Indian grouping (12,50,000), tabular nums, right-aligned money.
- Mobile-first: left sidebar collapses to a bottom tab bar; tables scroll horizontally; nav is accessible via keyboard; touch targets ≥ 44px.
- Dashboards auto-refresh every 10s.

## Test checklist
1. **Valid code** — submit `LOANH123456` with valid fields; expect a report ID, category, status, handler/waiting/correction info, and routing_reason.
2. **Invalid code** — type `LOANX12345` or `LOANH12345`; expect inline "Use LOAN + H/V/P/E + 6 digits" error and submit blocked.
3. **Duplicate** — resubmit the same application code; expect a clear 409 "Duplicate report" message with the existing report ID.
4. **Unknown zone** — type a zone not in North/South/East/West/Central; live preview should show a zone_fallback notice.
5. **Capacity overflow** — Handler desk: set capacity to 51 or -1; expect "Capacity must be an integer between 0 and 50".
6. **Critical override** — submit a critical-urgency report; confirm it appears with a red left bar on the row and in Analytics "Escalated".
7. **Status updates** — Handler desk: Start (Pending → In Progress) then Resolve (In Progress → Resolved); confirm status pill and history timeline update.
