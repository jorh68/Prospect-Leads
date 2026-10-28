# Prospect Leads — Architecture

This document is the contract between the modules of Prospect Leads. Each
module is built by a separate work stream; read the section for your module
and the shared conventions before writing code. When a contract has to
change, change it **here first** and keep the change additive.

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) | Read `node_modules/next/dist/docs/` — v16 differs from older versions (async `params`, `PageProps<"/route">`, `RouteContext`). Cache Components are **off**; the root layout sets `dynamic = "force-dynamic"`. |
| Language | TypeScript (strict) | `npm run typecheck` |
| Styling | Tailwind CSS v4 with tokens in `src/app/globals.css` | No other UI kit. Icons: `lucide-react`, functional only. |
| Database | Prisma 6 + SQLite (`prisma/dev.db`) | Schema is Postgres-ready (no SQLite-only features, enum-like values are strings). |
| Validation | zod 4 | All external input (forms, API bodies, Json columns). |
| Background work | `Job` table + in-process worker | Started from `src/instrumentation.ts`; survives restarts. |
| AI (optional) | `@anthropic-ai/sdk` via `src/lib/llm` | Every AI feature needs a rules-based fallback. |
| Tests | Vitest | `tests/**/*.test.ts`; `server-only` is aliased to a no-op. |

Commands: `npm run dev`, `npm run build`, `npm test`, `npm run lint`,
`npm run typecheck`, `npm run db:migrate` (creates a migration),
`npm run db:deploy` (applies migrations).

## 2. Non-negotiable rules

1. **No fabricated data.** Never seed, mock or estimate businesses, ratings,
   reviews, findings or results and show them as real. A value we do not
   have is `null` and the UI says "No disponible". Test fixtures use
   obviously fictional names ("… Ejemplo") and never touch `prisma/dev.db`.
2. **Evidence and provenance.** Every company field keeps its origin in
   `Company.fieldSources` and the raw provider record in `CompanySource`.
   Every `Finding` and `Opportunity` stores the evidence it is based on.
3. **Missing credentials are not errors.** Integrations read their keys via
   `env()` / `integrations` in `src/lib/env.ts`. Without a key the feature
   degrades and tells the user which variable to set (see `/settings`).
4. **Heuristics are labelled as heuristics.** Scores and estimates are
   explained, never presented as scientific measurements.
5. **Errors are visible and specific.** Use `ExternalServiceError` /
   `fetchWithRetry` from `src/lib/http.ts` for every outbound call; persist
   the error on the row that failed (`Search.error`, `Analysis.error`,
   `Job.error`) and log with a `[module]` prefix.

## 3. Directory layout and ownership

```
prisma/schema.prisma          shared — additive changes only, one migration per change
src/instrumentation.ts        foundation — starts the job worker
src/app/
  layout.tsx, globals.css     foundation — shell + design tokens
  page.tsx                    C  dashboard
  searches/**                 foundation — search form, history, results
  companies/page.tsx          C  list, search and filters
  companies/[id]/**           B  company page, messages, report
  pipeline/**                 C  CRM pipeline
  settings/**                 foundation — integration status
  api/searches/**             foundation
src/components/
  ui/**                       foundation — design system (extend, don't fork)
  shell/**                    foundation — sidebar/nav (nav items in shell/nav.ts)
  domain/badges.tsx           foundation — status/score/provider badges
  searches/**                 foundation
  analysis/**                 A  (if A needs UI pieces B can embed)
  company/**                  B
  crm/**                      C  (CrmPanel embedded by B on the company page)
  dashboard/**                C
src/lib/
  env.ts db.ts http.ts text.ts format.ts activity.ts cn.ts   foundation
  domain/constants.ts         shared vocabulary (additive changes only)
  domain/types.ts             shared contracts (additive changes only)
  jobs/**                     foundation — queue, worker, handler registry
  llm/**                      foundation — optional Anthropic wrapper
  discovery/**                foundation
  analysis/**                 A  website analysis, findings, opportunities, scoring
  messages/**                 B  outreach messages
  reports/**                  B  report snapshot + PDF
  crm/**                      C  CRM actions and queries
```

Rule of thumb: edit only files your module owns. If you need something from
another module, use its documented contract below; if it does not exist,
add the smallest additive piece and note it in your PR.

## 4. Data model (prisma/schema.prisma)

| Model | Purpose | Written by | Read by |
| --- | --- | --- | --- |
| `Search` | A niche + location request, status, warnings, geocoded area | discovery | all |
| `SearchResult` | Company ↔ search link with rank | discovery | foundation, C |
| `Company` | One real business. Discovery fields + CRM fields + denormalised `score`, `opportunityCount`, `analysisStatus`, `analyzedAt` | discovery, A (analysis fields, email/socials from web), C (CRM fields) | all |
| `CompanySource` | Raw payload per provider (`osm`, `google_places`, `website`) | discovery, A (`website`) | B (sources panel) |
| `SocialProfile` | Social links with the source that reported them | discovery, A | B, C |
| `Analysis` | One analysis run: URL, HTTP status, timing, `signals` JSON, `summary`, `generator` | A | B |
| `Finding` | Evidence-backed observation (`kind`: positive/neutral/issue, `severity`) | A | B, C |
| `Opportunity` | Problem → evidence → consequence → solution, `serviceKey`, `impact`, `confidence` | A | B, C |
| `Score` | 0–100 total + `breakdown` (`ScoreFactor[]`) | A | B, C |
| `Message` | Outreach text per channel with its `basis` (facts used) | B | B |
| `Report` | Frozen JSON snapshot of a company report | B | B |
| `Note` | CRM notes | C | B (via CrmPanel), C |
| `Activity` | Append-only log (`logActivity()`) | everyone | C (dashboard feed) |
| `Job` | Persistent background queue | foundation (worker) | — |

Enum-like columns are strings; allowed values and Spanish labels live in
`src/lib/domain/constants.ts` (`CRM_STATUSES`, `SERVICES`, `SEVERITIES`,
`FINDING_CATEGORIES`, `ACTIVITY_TYPES`, …). Json columns have zod schemas in
`src/lib/domain/types.ts` — parse them with `safeParse` when reading.

Schema changes: add fields/models without renaming or removing existing
ones, run `npx prisma migrate dev --name <module>_<change>`, commit the
migration. Two streams must not edit the same model in parallel; if you
must, coordinate through the coordinator.

## 5. Conventions

- **Language:** UI copy in Spanish (es-ES). Code, comments and identifiers in English.
- **Data access:** Server Components query Prisma directly through
  `db` from `src/lib/db.ts`. Put reusable queries in the module's `lib`
  folder (`src/lib/<module>/queries.ts`).
- **Mutations:** Server Actions in `src/app/<route>/actions.ts` or
  `src/lib/<module>/actions.ts`, validated with zod, returning
  `{ error, fieldErrors }` state for forms (see `src/app/searches/actions.ts`).
  JSON route handlers under `src/app/api/` only where a client needs them
  (polling, downloads, programmatic use).
- **Activity:** every user-visible state change calls `logActivity()` with a
  Spanish sentence (`"Estado cambiado a Contactada"`).
- **Long work:** never do slow network work inside a request. Enqueue a job
  (`enqueueJob` / `enqueueAnalysis` in `src/lib/jobs/queue.ts`), register the
  handler in `src/lib/jobs/handlers.ts`, report progress with
  `setJobProgress`, and let the page poll with `<AutoRefresh />`.
- **Outbound HTTP:** `fetchWithRetry` / `fetchJson` (timeouts, retries,
  User-Agent, service-named errors).
- **Formatting:** `src/lib/format.ts` (dates, numbers, ratings, URLs).
- **Testing:** pure logic gets unit tests; pipelines get an integration test
  with a throwaway SQLite file and stubbed `fetch` (see
  `tests/integration/discovery-pipeline.test.ts`).

## 6. Design system

Light B2B look: white panels on a light grey canvas, neutral greys, near-black
text, **one accent** (cobalt, `accent-*`). Status colours (`success`,
`warning`, `danger`) are for state badges and alerts only.

- Base font size 14px (Inter). Tables 13px, labels 11–12px.
- Building blocks in `src/components/ui`: `Button`/`ButtonLink`,
  `Input`/`Select`/`Textarea`/`Field`, `Badge`, `Table` family, `Panel`,
  `PageHeader`/`PageBody`, `Stat`, `Alert`, `EmptyState`, `ProgressBar`,
  `Spinner`. Domain badges in `src/components/domain/badges.tsx`
  (`CrmStatusBadge`, `ScoreBadge`, `SearchStatusBadge`, `AnalysisStatusBadge`,
  `ProviderBadge`).
- Pages: `PageHeader` (title, description, actions) + `PageBody` with
  `Panel`s. Prefer tables and definition lists over cards.
- Avoid: big cards, gradients, glassmorphism, decorative icons, charts that
  don't answer a question, empty whitespace. Every chart must have a title
  that states what it shows.
- Responsive: sidebar collapses under `lg`; wide tables scroll inside
  `TableContainer`. Check 390px and 1440px.

## 7. Discovery (foundation — done)

`createSearch({ niche, location, count })` → `Search` + `discovery` job.
`runDiscoveryJob`:

1. `matchNiche()` maps the niche to OSM tags / Google type (`discovery/niches.ts`);
   unknown niches fall back to a name search.
2. Nominatim geocodes the location (`providers/osm.ts`).
3. Google Places Text Search when `GOOGLE_PLACES_API_KEY` is set (max 60).
4. Overpass returns mapped businesses in the area; ranked by data completeness.
5. `mergeProviderResults()` de-duplicates across providers (domain, phone,
   name + distance; chain branches far apart stay separate). Google values
   win, OSM fills gaps; `fieldSources` records the origin of every field.
6. `persistBusiness()` upserts companies (re-runs reuse existing rows,
   refresh rating/reviews/hours) and links them to the search.
7. When `analysisAvailable` (from `src/lib/analysis`) is `true`, every found
   company is queued for analysis.

Sources and what they provide: OSM — name, category, website, phone, email,
address, hours, socials (when mapped; **no ratings/reviews**). Google Places
— adds rating, review count, hours, Maps URL, business status.

## 8. Module A — website analysis, opportunities, scoring

Owns `src/lib/analysis/**` (and `src/components/analysis/**` if needed).

Entry point (already registered): `runAnalysisJob(job)` in
`src/lib/analysis/index.ts`, payload `{ companyId }`. Set
`export const analysisAvailable = true` when ready.

Must:
- Create an `Analysis` row (`status`, `version`, `url`, `finalUrl`,
  `httpStatus`, `loadTimeMs`, `pageBytes`, `signals`, `summary`, `generator`).
- Fetch the company website (home + a few same-domain pages such as
  contacto/reservas, with limits and timeouts). Companies without a website
  are still analysed: the absence is itself evidence.
- Detect signals: value proposition clarity, CTAs, forms, booking systems
  (and which vendor), contact methods, WhatsApp, chat widgets, tracking /
  CRM / marketing tags, lead capture, mobile viewport, technical problems
  (HTTPS, errors, weight, load time), linked socials, reviews/reputation
  (from `rating`/`reviewCount` when available).
- Write `Finding[]` (`FindingInput` schema) — each with literal evidence
  (snippet, URL, metric) and an interpretation of why it matters.
- Write `Opportunity[]` (`OpportunityInput`): problem, evidence, consequence,
  solution, `serviceKey` from `SERVICES`, impact, confidence. Only when the
  evidence supports it.
- Write a `Score` with `breakdown: ScoreFactor[]` (factor, label, weight,
  value, points, explanation) — weights sum to 1, total 0–100. Document the
  heuristic in code and in the UI copy ("puntuación heurística").
- Update `Company`: `score`, `opportunityCount`, `analyzedAt`,
  `analysisStatus`, plus `email` / socials found on the site (with
  `fieldSources[field] = "website"` and a `CompanySource` row with
  provider `website`). Move `crmStatus` from `new` to `analyzed` only if it
  is still `new`.
- Log `analysis_completed` / `analysis_failed` activities.
- Provide a way to (re)analyse one company: a server action
  `analyzeCompanyAction(companyId)` in `src/lib/analysis/actions.ts` that
  calls `enqueueAnalysis` (B wires the button on the company page).
- LLM (optional): interpret signals into the summary / opportunity wording
  via `generateObject`; the rules path must produce complete output alone.

## 9. Module B — company page, messages, PDF report

Owns `src/app/companies/[id]/**`, `src/components/company/**`,
`src/lib/messages/**`, `src/lib/reports/**`.

- Company page: overview header (score, status, key facts), contact, web,
  socials, reviews, analysis summary, findings grouped by category,
  opportunities (problem / evidence / consequence / solution / impact /
  confidence), score breakdown ("¿Por qué esta nota?"), services to offer
  (from opportunities' `serviceKey`), next actions, sources with field
  provenance. Embed C's `<CrmPanel companyId=… />` and A's
  `analyzeCompanyAction` button. Must render sensibly for companies not yet
  analysed.
- Messages (`Message`): email (with subject), LinkedIn, WhatsApp versions.
  Built only from real facts (company data, findings, opportunities); store
  them in `basis` (`MessageBasis`). Short, specific, opens a conversation.
  LLM when available, otherwise a rules-based composer that still cites
  specific facts. Editable and persisted; `logActivity("message_generated")`.
- Report (`Report`): freeze a JSON snapshot (situation, problems, evidence,
  opportunities, recommendations, systems to implement, potential impact),
  render a print-quality HTML view and export to PDF (recommended:
  server-side generation, e.g. `@react-pdf/renderer`, so the download works
  everywhere without a browser binary). `logActivity("report_generated")`.

### Module B — as built

- `src/lib/reports/dossier.ts` `loadCompanyDossier(id)`: company + sources +
  latest analysis (any status) + latest *completed* analysis with its findings,
  open opportunities (sorted by impact × confidence) and score. Page, messages
  and reports all read this.
- Messages: `src/lib/messages/compose.ts` (rules composer; refuses without an
  open opportunity), `generate.ts` (LLM via `generateObject` with fact ids,
  falls back to rules), `actions.ts` (`generateMessagesAction`,
  `updateMessageAction`). Every generation adds 3 rows (history kept); the page
  shows the latest per channel. Signature from `OUTREACH_SENDER_NAME` /
  `OUTREACH_SENDER_COMPANY`, otherwise a visible `[Tu nombre]` placeholder.
- Reports: `snapshot.ts` builds `ReportContent` (`schema.ts`, versioned),
  `generate.ts` stores it, `/companies/[id]/report/[reportId]` renders the
  HTML view and `/pdf` streams the PDF from `pdf.tsx` (`@react-pdf/renderer`,
  server-side). Reports require a completed analysis.
- Next actions (`next-actions.ts`) and services (`services.ts`) are derived
  rules over real state, never generated text.

## 10. Module C — dashboard, CRM, search & filters

Owns `src/app/page.tsx`, `src/app/companies/page.tsx`,
`src/app/pipeline/**`, `src/components/crm/**`, `src/components/dashboard/**`,
`src/lib/crm/**`.

- CRM actions (`src/lib/crm/actions.ts`): change `crmStatus`, set `owner`,
  `nextAction`, `followUpAt`, add/edit/delete `Note`. Each logs activity
  (`status_changed`, `owner_changed`, `followup_set`, `note_added`).
- `<CrmPanel companyId />` (server component + client controls) used by B on
  the company page.
- Companies list with URL-driven filters: name, niche, location (city),
  score range, opportunity count, detected problem (`Finding.key` with
  `kind = "issue"` / `Opportunity.type`), recommended service
  (`Opportunity.serviceKey`), CRM status, rating, review count; sorting and
  pagination; bulk "analyse" via `enqueueAnalysis`.
- Pipeline: board or grouped table by CRM status, follow-ups due.
- Dashboard: companies found / analysed, priority opportunities, score
  distribution, most common problems, services with most opportunity,
  pipeline status, recent activity. Charts only where they answer a question.

## 11. Integration checklist (final stream)

Run the app with real data (network access required): search → companies
appear with sources → analyses complete → scores explained → company page →
messages → CRM changes → report PDF → reload and verify persistence. Check
server logs, browser console, 390px and 1440px layouts, and that no screen
shows invented data.
