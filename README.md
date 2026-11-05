# Campaign Management Portal — Seoudi Supermarket

Internal portal for planning, executing, tracking and evaluating promotional campaigns end to
end. Built as an MVP against the *Campaign Management Portal — PRD v1.0* (5 Nov 2026).
PRD gaps found during review and how each was resolved: **[docs/PRD-GAPS.md](docs/PRD-GAPS.md)**.

## What's inside (Phase 1 scope)

| Section | PRD | Highlights |
|---|---|---|
| **Authentication** | §02 | Username/password (scrypt-hashed), 12h signed sessions, own password change, Admin-managed accounts |
| **Roles & permissions** | §03 | Admin · Growth Manager · Growth Supervisor · Content Team · Performance Member — nav hidden per role, direct URL access to restricted sections → 403 page |
| **Planning layer** | §04 | Campaign calendar grouped by month (themes, targets, statuses), read-only; populated by Admin import |
| **Campaign pipeline** | §05 | 5-stage board (In Pipeline → Hub Pending → Depots Pending → Content Pending → Live) with search (title / CMP ID / SKUs, Arabic folding), SLA flags (Needs Attention / Locked Out), brief submission form |
| **Stock readiness** | §06 | Sheet import with all-or-nothing validation, Hero 100% / Regular 90% thresholds, per-depot dots, auto-calculated readiness (Ready / Needs Attention / Blocked) |
| **Campaign actions** | §07 | Publish (date-locked with per-condition tooltips), Reject, Hold & Set New Date, Pause/Resume, Accept brief, Send back, Content approve/reject, Mark taken down |
| **Notifications** | §08 | Campaign-linked + global planner, AR/EN copy with live character counters, Draft → Pending review → Approved/Rejected flow |
| **Activity log** | §09 | Optimization actions linked to 1–N campaigns, owner auto-locked, filters, monthly rollup |
| **Performance** | §10 | Monthly dashboard: revenue vs target (primary KPI), published/planned/unpublished, success rate, CTR/conversion/OOS, SLA compliance, failure analysis, activity correlation, "Manual import — [date]" source flag |
| **Sheet imports** | §11 | 3 Admin-only importers (calendar / stock / performance) with row-level error reports and import history |
| **Global rules** | §12 | Ended → Archive lifecycle, deactivated users keep history, SLA dashboard per team, PRD empty states |

## Tech stack

- **Next.js 15** (App Router, Server Actions, server components) + **TypeScript** + **Tailwind CSS**
- **Kysely** query builder with two runtime dialects — zero native dependencies:
  - **SQLite via `node:sqlite`** (built into Node ≥ 22) when `DATABASE_URL` is unset → local dev just works
  - **Postgres** (`pg`) when `DATABASE_URL` is set → Vercel / production
- Schema auto-creates on first access; demo data auto-seeds when the DB is empty.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

That's it — the first request creates `data/portal.sqlite` and seeds demo data.
`npm run seed` prints demo logins (idempotent; only seeds an empty DB).

### Demo accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin123!` | Admin |
| `growth` | `Growth123!` | Growth Manager |
| `supervisor` | `Supervisor123!` | Growth Supervisor |
| `content` | `Content123!` | Content Team |
| `performance` | `Performance123!` | Performance Member |

> Change these before any real deployment — or disable the demo seed by populating the users
> table before first boot.

### Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run seed       # idempotent demo seed
npm run typecheck  # tsc --noEmit
```

## Deploying to Vercel (MVP)

The repo is a standard Next.js app — Vercel auto-detects it, **zero config required**.

1. **Push the repo to GitHub** (this repository).
2. **Import in Vercel**: vercel.com → *Add New… → Project* → select
   `campaign_management` → *Deploy* (all build settings auto-detected).
3. **Create a Postgres database** for the deployment (any of these work):
   - Vercel Postgres (Storage tab in the project → *Create Database*), or
   - [Neon](https://neon.tech) / [Supabase](https://supabase.com) free tier.
4. **Set environment variables** (Project → Settings → Environment Variables):
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres connection string |
   | `SESSION_SECRET` | `openssl rand -hex 32` output — **required in production** |
5. **Redeploy.** On first request the schema is created and demo data seeded automatically.
6. Log in as `admin / Admin123!` (or `ADMIN_USERNAME` / `ADMIN_PASSWORD` env overrides)
   and change the admin password.

Without `DATABASE_URL` the app still runs on Vercel using `node:sqlite` (Node 22 runtime),
but writes hit an ephemeral filesystem — **use Postgres for anything real**.

### Import sheet templates

CSVs are imported from **Sheet imports** (Admin). Header names are matched
case-insensitively; dates accept `YYYY-MM-DD`, `DD/MM/YYYY`, `YYYY/MM/DD`; months accept
`YYYY-MM`, `MM/YYYY`. See the column tables on the Imports page, or:

- [docs/samples/campaign_calendar_sample.csv](docs/samples/campaign_calendar_sample.csv)
- [docs/samples/stock_values_sample.csv](docs/samples/stock_values_sample.csv)
- [docs/samples/performance_results_sample.csv](docs/samples/performance_results_sample.csv)

## Repository layout

```
app/                  # Next.js App Router pages + server actions
  (portal)/           #   authenticated sections (board, planning, stock, …)
  actions/            #   server actions (auth, campaigns, notifications, …)
components/           # client + shared UI components
lib/                  # domain logic
  db.ts               #   Kysely setup, dual dialect, schema bootstrap, auto-seed
  node-sqlite.ts      #   node:sqlite driver shim for Kysely
  auth.ts             #   sessions, guards            permissions.ts  role matrix
  campaigns.ts        #   readiness + SLA + publish rules
  importers.ts        #   CSV validation/commit pipeline
  seed.ts             #   demo data
docs/                 # PRD gap analysis + sample import sheets
```

## Notes

- **Dates**: stored ISO (`YYYY-MM-DD` / ISO timestamps), displayed en-GB; currency EGP.
- **Working days** for SLA: Sunday–Thursday (Egypt weekend Fri/Sat) — configurable in
  `lib/format.ts`.
- **Security**: scrypt password hashing, HMAC-signed HttpOnly cookies, role checks in every
  server action and page. Add rate limiting/lockout before exposing beyond an internal VPN.
