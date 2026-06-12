# Family Hub — Claude Code Working Context

Read this first. It tells you what this project is, how it's structured, and the rules of the road.

## What this project is

A self-hosted family calendar + chore management system that runs on a Raspberry Pi 5 with a portable touchscreen, reachable from any device on the home WiFi. No cloud, no subscriptions, no external accounts. It is built on top of an open-source base app (**Skylite-UX**) which is forked and extended with custom features.

Think "DIY Skylight." Full feature/hardware/build detail lives in `docs/`.

## Architecture / stack

- **Base app:** Skylite-UX (**AGPL-3.0**, copyleft — upstream relicensed from MIT) — https://github.com/Wetzel402/Skylite-UX. Fork it; don't rebuild from scratch. Our fork inherits AGPL-3.0: it must stay open-source, network users are owed source (AGPL §13), and a closed-source/proprietary-SaaS version is not an option. The copy-and-run model is fully compatible.
- **Frontend:** Nuxt.js + TailwindCSS
- **Backend:** Node.js
- **Database:** PostgreSQL
- **Deploy:** Docker Compose (`docker compose up -d`)
- **Calendar:** read-only iCal URL pull (Apple/Google). No Apple ID stored.
- **Network:** LAN-only by default; optional Tailscale for remote.
- **Display:** Chromium kiosk mode, fullscreen at boot; cron-driven sleep/wake.

## What Skylite-UX already gives us (don't rebuild)

Calendar with month/week views, iCal sync **and full Google Calendar OAuth** (not just Apple), grocery list ("Shopping Lists"), per-person todos (with recurrence fields `rrule`/`recurringGroupId` already on the model), dark mode + settings panel, Docker Compose deploy. Partial color-coded events. Recipe-app integrations (Mealie/Tandoor) are wired in.

⚠️ **NOT what it sounds like — there is NO authentication.** Upstream has _User Management_ (profiles with name/color/avatar) but **no logins, passwords, sessions, or auth middleware** — `index.vue` itself carries a `// TODO: Authenticate user or route to login page`. Anyone on the LAN currently acts as anyone. **Auth is unbuilt and is a prerequisite for parental controls, per-kid chore check-off, reward approval, and per-person points.** See `docs/features-to-build.md`. (Audited against upstream commit `ffcd435`, 2026-04-02.)

## What we are building on top (the actual work)

Organized by phase in `docs/build-order.md`. Summary:

- **P1 Core:** points + chore tracking, rewards store, recurring chores, family message board, meal planner, dinner schedule
- **P2 Gamification:** streaks, badges, celebration screen, leaderboard
- **P3 Display/automation:** photo screensaver, sleep mode, motion wake, color-coded events, parental controls
- **Settings panel** consolidating all config (see `docs/settings-spec.md`)

## Decisions made (locked)

- **Where it runs:** the _app_ runs on the Pi via Docker. **Development happens on a dev machine (Mac/PC), not on the Pi.** The Pi is headless Pi OS Lite with 4GB shared across Docker + Postgres + Node — fine for running the built stack, sluggish for a live dev loop. Because the whole thing is Docker Compose, it runs identically on a laptop and on the Pi, so we build and test locally and deploy to the Pi with `git pull && docker compose up -d`. **No Pi hardware is needed to start building** — see `docs/dev-workflow.md`.
- **Fork strategy:** vendor Skylite-UX into this repo as a fork we own (single repo, single `docker-compose.yml`). One repo to hand off and one repo another family can clone. The upstream stays a remote so we can pull fixes.
- **Calendar:** Apple iCal is our target (read-only URL pull). Note: upstream _already ships_ a working Google Calendar OAuth integration too, so Google is available for free if wanted. UI lets you add/remove sources generically.
- **Hardware:** not bought yet. Phase 1 is procurement; development proceeds in parallel without it.

## Design principle: build it to be copied

A hard requirement is that another family can clone this and run their own. That shapes every decision:

- **Zero hardcoded family data.** No names, colors, chores, or counts baked into code. Everything seeds from config / the setup wizard and lives in the DB.
- **First-run setup wizard.** A fresh clone boots to a "create your family" flow (admin account, add members, assign colors) — not to our family's data.
- **All config in `.env` + Settings UI.** Secrets, ports, iCal URLs, sync frequency, sleep/wake times — never in source.
- **Clean install docs** so a non-developer can follow `docs/installation.md` end to end.
- Treat "could another family run this with zero code edits?" as the acceptance test for any feature.

## Repo conventions

- Vendor Skylite-UX as our fork; `upstream` remote points at the original for pulling fixes.
- Custom work in feature branches per phase (see `docs/build-order.md`).
- DB schema changes go through migrations, never manual edits — and ship seed-free (no family data in migrations).
- **Authed data fetching:** server-rendered pages must forward the session cookie on SSR — use `useFetch` or `useRequestFetch()`, never raw `$fetch` inside `useAsyncData` (it 401s on SSR → empty data that never refetches client-side). For per-user / time-sensitive data (e.g. the chores board, where "today" must be the client's local date and the container is UTC), fetch client-only (`useAsyncData(..., { server: false })`) and wrap the rendered list in `<ClientOnly>`.
- **Completion-records, not reset flags:** recurring state (chores) is tracked as dated completion rows, so "reset" is implicit each new day — no cron — and history is kept for points/streaks/leaderboard.
- Cron-style recurring logic that _does_ need it (leaderboard reset, sleep/wake) runs inside Docker / on the Pi — document each job.
- Keep everything LAN-safe: never add code that phones home or opens external ports by default.
- **Sessions on the kiosk:** waking from the screensaver clears the session and lands on the profile picker (lock-screen semantics). Members with **no PIN** tap straight in (kid profiles); every ADMIN — and any member a parent gave a PIN — enters it. Don't add a PIN-less path for admins.
- **Parent unlock (elevation):** the kiosk stays signed in as an ADMIN, so role checks alone can't tell a parent from a kid at the shared screen. Management mutations (chore/badge/reward/user/integration CRUD, approvals, point adjustments, school-item CRUD) require a fresh admin PIN: server-side `requireElevatedAdmin` (403 `ELEVATION_REQUIRED` → client retry contract), client-side `useAdminGate().gate(fn)` + the shared PIN modal in `app.vue`. Kid flows (completing own chores/school items, messages, redeeming, own-PIN change) stay ungated. New admin mutations MUST use this pattern.
- **One points pool:** chore completions, school-item completions, and manual adjustments all derive the displayed totals and the rewards balance (`server/utils/points.ts` is the union point). Adjustments affect POINTS ONLY — badges/streaks/completion counts are computed from completion events exclusively (`pointsTotalRaw` feeds badge evaluation, never the net).

## Docs index

- `docs/overview.md` — what you're building, full feature list
- `docs/hardware.md` — parts list, screen + Pi mounting, costs
- `docs/installation.md` — step-by-step Pi setup, Docker, kiosk, sleep cron
- `docs/features-to-build.md` — every custom feature with build approach + effort
- `docs/settings-spec.md` — full settings panel spec
- `docs/network-security.md` — privacy model, network setup, Tailscale
- `docs/build-order.md` — phased build plan (start here for sequencing)
- `docs/dev-workflow.md` — where to develop, how to deploy to the Pi, multi-family packaging
- `docs/source-handoff.md` — original handoff doc, verbatim, as source of truth
- `docs/skylite-ux-review.md` — pre-fork code review + security audit of upstream Skylite-UX (`ffcd435`), with a remediation sequence for the fork
- `docs/pi-hardware.md` — Pi-only sleep/motion-wake add-ons (UNTESTED, requires Pi hardware)
- `docs/deployment.md` — prebuilt-image deploy + Watchtower auto-updates + how to cut a release

## Status

**Feature-complete, rebranded "Family Hub", and published to GHCR.** Built and verified (API + browser, both admin/member personas): first-run setup + PIN-based auth (admin/member roles), calendar, a **Today dashboard** (per-person chores + today's calendar + today's school note), per-person chores + points, gamification (streaks, **admin-editable badges**, celebration, leaderboard), meal planner + auto grocery list (**quantities summed across days**), family message board (post-as-anyone + any-member delete), **rewards store** (admin-editable), a **per-kid weekly school grid** (free-text, own-or-admin edit), a parent-controlled settings panel (roles, PINs, account, screensaver photo upload), and a photo screensaver with QR access. The visible UI was rebranded from the upstream "SkyLite UX" to **"Family Hub"** (the AGPL `LICENSE` + upstream attribution are deliberately kept). Ops: a GHCR multi-arch auto-update pipeline (release tags → image → Watchtower) and a scheduled `pg_dump` backup sidecar with a verified restore. **Latest release: `v2026.6.6`.**

**June 2026 update batch (post-v2026.6.4, unreleased):** QR code now encodes the host LAN address (`APP_PUBLIC_URL` env → interface detection → guidance); todo board horizontal scroll fixed (height chain + visible scrollbar + wheel panning in `globalList.vue`); **parent unlock** (PIN elevation, see conventions) gates all management actions on the shared kiosk; **multi-assignee chores** (join table, each person completes their own copy; data-preserving migration); **manual point adjustments** ("−20 — fighting", points-only, kid-visible reasons); **structured school items** (assignable, dated, check-off like chores, same points pool, overdue carry-forward) alongside the free-text notes grid; **badge upgrades** (ANDed multi-conditions as JSON, per-member appliesTo, editor moved to Settings, tooltips); **interactive dashboard** (check off chores + school items from Today, per-member points/streak chips, celebration). All four migrations rehearsed against a seeded v2026.6.4-schema database AND a fresh `migrate deploy`; full API smoke test passed (setup → elevate → multi-assign → complete → adjust → school → badges → lock).

**Released as `v2026.6.5`** (2026-06-10): multi-arch image published to GHCR, `:latest` moved, and the package is **public** (anonymous pull verified). **`v2026.6.6`** (2026-06-11) ships the Node 22 build, the Dependabot security clearance (24 → 0), and the hot-path perf batch.

**June 2026 batch 2 (post-v2026.6.6, unreleased):** dashboard rebuilt as **per-person columns** (auto-fit grid wraps/stacks when tight; tap a header to collapse; per-person calendar events via the existing event↔user links; family-wide meals/events strip on top); **school "Students only" toggle** (hides ADMIN rows, per-device preference, default on); **grocery-list export** (share icon on any list → plain text copy / .txt download / QR that phones scan); **saved-meals repository** (`SavedMeal` model; sidebar on the planner; drag a card onto a day OR pick from a dropdown in the meal dialog; "Save for later" captures a planned meal); **4 new badge rule types** — `EARLY_BIRD` (≥N tasks before an hour, family-tz via `NUXT_PUBLIC_TZ`), `WEEKEND_COMPLETIONS`, `HIGH_VALUE_COMPLETIONS` (≥N tasks worth ≥X pts), `ROLLING_AVG_POINTS` (avg over last W tasks, requires ≥W) — evaluated from completion events (`getCompletionEvents` now carries `completedAt`); **task timer** (timer icon on chore/school rows → presets/custom countdown overlay, auto-completes + celebration at zero); **screensaver wake = lock screen** (session cleared → profile picker; **kid tap-in**: MEMBERs with no PIN sign in by tapping their avatar, admins always PIN — login API allows PIN-less login ONLY for role=MEMBER with null pinHash); **unread-notes notifications** (`MessageRead` per-user pointer; red badge on the sidebar Family Board tab + dashboard banner; clears on visiting the board; 60s poll + per-navigation refresh). Two migrations: `add_message_reads`, `add_saved_meals`. Verified: 866/866 tests (13 badge-rule cases), lint + type-check green, API-verified live (all 4 login rules, unread lifecycle, saved-meals gating, badge validation 400s, live award of EARLY_BIRD + HIGH_VALUE on completion). Drag-drop/timer/QR client interactions reviewed but not browser-driven. What remains is **not code**: hardware procurement + Pi deployment. ⚠️ The **arm64 image has not been runtime-tested** (no Pi yet). ✅ **Backups verified end-to-end against the prod compose** (2026-06-11): seeded stack → sidecar dump captured all tables + rows (incl. PIN hashes) → `DROP SCHEMA public CASCADE` → restore from the dump → app boots and admin PIN login works. The old ~390 B dumps were the sidecar's **start-time** dump of a not-yet-migrated database — expected on a fresh stack, not a bug; every interval dump after data exists captures everything. Remaining open feature-design items are in `OPEN-QUESTIONS.md`.

## Where to pick up

Development now is feature tweaks + deployment, not bootstrapping. Useful entry points:

- **Deploy to a Pi:** `docs/deployment.md` (prebuilt image + Watchtower) or `docs/installation.md`. First flip the GHCR package public so the Pi can pull.
- **Cut a release:** push a `vX.Y.Z` tag → CI builds + publishes the multi-arch image (bump `package.json` + lockfile to match first). See `docs/deployment.md`.
- **Add/adjust a feature:** it will mirror an existing one — chores (`server/api/chores/*` + `app/pages/chores.vue`), rewards, meals, badges, school, message board, dashboard. Follow the repo conventions above (migrations; authed SSR fetch via `useRequestFetch`; completion-records, no cron; client-local dates).
- **Open questions:** `OPEN-QUESTIONS.md`.
