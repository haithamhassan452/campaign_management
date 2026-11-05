# PRD Gap Analysis — Campaign Management Portal

**PRD:** Campaign Management Portal — PRD v1.0 (5 November 2026)
**Review date:** 5 November 2026 · reviewed during MVP build
**Status:** every gap below was resolved with a documented assumption so the MVP could ship.
Each item should be confirmed or corrected in PRD v1.1.

---

## A. Contradictions (the PRD says two different things)

### 1. Board columns: 5 stages vs a "Marketing" column
- **§05** defines the board as a **5-stage** pipeline: In Pipeline → Hub Pending → Depots
  Pending → Content Pending → Live.
- **§12** (empty states) references a *"Board — Marketing column"*, filling up when something
  is *"sent back over stock"*, and says *"a new brief goes straight to Procurement"*.
- **§12** (SLA dashboard) lists six teams — Procurement, DS_Zayed, DS_Maadi, DS_Kitkat,
  Content, **Marketing** — which don't map cleanly onto the five stages (no Procurement or
  Marketing stage exists; Hub has a stage but no SLA team).
- **MVP resolution:** the §05 5-stage board is authoritative. "In Pipeline" is the Procurement
  queue (briefs land there and are accepted by Procurement/Admin). "Sent back over stock" is a
  **Send back** action that returns a card to In Pipeline with a reason and an amber *Sent back*
  flag. Marketing appears in the SLA dashboard driven by sent-back events. **Recommendation:**
  decide whether Marketing/Procurement are real board columns and align §05/§12.

### 2. Revenue target source
- **§10** metrics table: *"Sales revenue vs target — Actual revenue vs planned target
  **from brief**"*.
- **§05** brief form has **no revenue target field**; targets live in the planning layer (§04).
- **MVP resolution:** performance targets are resolved from the planning entry whose unique
  title matches the campaign (case-insensitive). No match → target shows "—". **Recommendation:**
  either add a read-only target display to the brief, or fix §10 wording to "from planning".

### 3. Activity log permissions
- **§03** table: Growth Manager = **"Full"** on Activity log.
- **§09** text: *"viewable by all roles but **only Performance Member and Admin** can create
  entries"* (stated twice).
- **MVP resolution:** create/edit = Admin + Performance Member; every role can view with all
  filters and rollups (Growth Manager's "Full" interpreted as full **view**).
  **Recommendation:** pick one and make the table match the narrative.

### 4. "Approve" action for Growth Supervisor
- **§03** grants Growth Supervisor *"Approve / Reject"* campaign actions.
- **§07** action buttons are Publish / Reject / Hold / Pause — there is no "Approve".
- **MVP resolution:** "Approve" is implemented as **Accept brief** (the Procurement gate that
  moves In Pipeline → Hub Pending). Supervisor can Accept + Reject only; Publish/Hold/Pause
  remain Admin/Growth Manager.

---

## B. Missing definitions (needed a value or rule)

| # | Gap | Where | MVP resolution |
|---|-----|-------|----------------|
| 5 | Notification **character limit** never defined (count is shown "vs limit") | §08 | 150 chars for Push/WhatsApp/Abandoned cart/Recurring; 250 for In-app. Live counter turns red and blocks save. |
| 6 | **"T-3 working days"** clock start point ambiguous | §05 | Deadline = 3 working days before **launch date**. Egypt weekend (Fri/Sat) excluded. Past deadline → Needs Attention; ≥5 working days overdue → Locked Out. Computed automatically on load. |
| 7 | **"Locked Out"** effect undefined — does it block Publish? | §05/§07 | No. Publish availability follows §07's exact three conditions. Locked Out is an escalation flag + permanent compliance record only. |
| 8 | Stock readiness **aggregation** across locations undefined (thresholds are per SKU type; Depot column includes "Hub") | §06 | Worst case across all rows: any Hero row <100% anywhere → Blocked; any Regular row <90% → Needs Attention; else Ready. |
| 9 | Depot **"confirmed"** definition undefined | §05 | A depot is confirmed when its latest stock rows exist **and** pass thresholds. Hub gate works the same way with Depot=Hub rows. |
| 10 | **Import file format** unspecified (CSV / XLSX / Google Sheet) | §11 | CSV upload (Sheets exports CSV natively). Header names matched case-insensitively. |
| 11 | **Campaign ID** start number ("sequential") unspecified | §05 | Auto-generated CMP-1001 upwards per brief. |
| 12 | **Password complexity** = "standard complexity" | §02 | Min 8 chars, ≥1 letter, ≥1 digit. |
| 13 | **Session policy** (timeout, lockout) unspecified | §02 | 12-hour HMAC-signed cookie; scrypt password hashing; no lockout/rate-limit in MVP — recommend Phase 2 hardening. |
| 14 | **Planning ↔ pipeline linkage** method unspecified | §04/§10 | Matched by unique campaign title (case-insensitive), per §04 "Campaign title = unique identifier". Unlinked planning entries show status "Planned". |
| 15 | **"Planned" count** denominator for monthly reports | §10 | Planning entries launching in the month + briefs launching in the month without planning rows (shown separately). |
| 16 | **Arabic search folding** — "variants are folded" without listing which | §05 | Alef variants (أ إ آ ٱ→ا), ta marbuta (ة→ه), alif maqsura (ى→ي), hamza forms, tashkeel stripped, case-insensitive. |

---

## C. Behaviors referenced but never specified

| # | Gap | Where | MVP resolution |
|---|-----|-------|----------------|
| 17 | **How campaigns advance** In Pipeline → Hub Pending (no action button exists; board is "read-only") | §05/§07 | "Accept brief" action in the detail panel (Admin / Growth Manager / Supervisor). Later gates are import-driven (stock import auto-advances Hub → Depots → Content) per §05's "Who advances: Admin (import)". |
| 18 | Content track *"runs parallel to stock"* but the board is a single left-to-right kanban — where does a card live? | §05 | Card position = furthest stock/pipeline gate reached; content status is an independent indicator on the card (Awaiting review / Approved / Rejected). |
| 19 | **Email notification** "Notification recipients receive an email notification on submit" — no recipients list, no email service | §05 | **Deferred.** No email infrastructure is defined anywhere in Phase 1. In-portal event history covers audit needs. Needs a decision (recipients, service) before Phase 2. |
| 20 | **"Mark as taken down"** referenced (Archive behavior) but no button in §07 | §12 | "Mark taken down" action for Content Team on Live/Ended campaigns → status Archived, moved to Campaign History. |
| 21 | **Hold** behavior once the new date also passes | §07 | Launch date simply moves (SLA recomputed); Publish shows "launch date has passed — use Hold to set a new date" until fixed. |
| 22 | **Detail panel** vs full page for actions | §05/§07 | MVP implements the detail panel as a dedicated campaign page (`/board/<id>`) — richer than an overlay for stock tables + history. Board itself stays read-only per PRD. |

---

## D. Out of scope (explicitly noted as deferred)

- **Email notifications** on brief submit (see #19).
- **GA4 live API** — Phase 2 per PRD; all performance data is manual import with the
  "Manual import — [date]" data-source flag implemented.
- **Magento / Algolia integrations**, physical stock, customer-facing features, SSO.

---

## E. Suggested PRD v1.1 checklist

- [ ] Reconcile board columns (5 stages vs Marketing/Procurement columns) and the six SLA teams.
- [ ] Define the revenue target source (brief vs planning) and update §10 wording.
- [ ] Pick one activity-log permission rule (table vs narrative).
- [ ] Rename Supervisor's "Approve" to "Accept brief" (or add an Approve action to §07).
- [ ] Add the notification character limits (or a config table) to §08.
- [ ] Specify working-day calendar (Egypt weekend) and the T-3 clock in §05.
- [ ] State whether Locked Out blocks Publish.
- [ ] Define import file formats and provide sheet templates.
- [ ] Decide the email notification story (recipients/service/Phase).
- [ ] Add security requirements: session TTL, lockout, rate limiting.
