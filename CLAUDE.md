# Family Hub — Claude Code Working Context

Read this first. It tells you what this project is, how it's structured, and the rules of the road.

## What this project is

A self-hosted family calendar + chore management system that runs on a Raspberry Pi 5 with a portable touchscreen, reachable from any device on the home WiFi. No cloud, no subscriptions, no external accounts. It is built on top of an open-source base app (**Skylite-UX**) which is forked and extended with custom features.

Think "DIY Skylight." Full feature/hardware/build detail lives in `docs/`.

## Architecture / stack

- **Base app:** Skylite-UX (MIT) — https://github.com/Wetzel402/Skylite-UX. Fork it; don't rebuild from scratch.
- **Frontend:** Nuxt.js + TailwindCSS
- **Backend:** Node.js
- **Database:** PostgreSQL
- **Deploy:** Docker Compose (`docker compose up -d`)
- **Calendar:** read-only iCal URL pull (Apple/Google). No Apple ID stored.
- **Network:** LAN-only by default; optional Tailscale for remote.
- **Display:** Chromium kiosk mode, fullscreen at boot; cron-driven sleep/wake.

## What Skylite-UX already gives us (don't rebuild)

Calendar with month/week views, iCal sync **and full Google Calendar OAuth** (not just Apple), grocery list ("Shopping Lists"), per-person todos (with recurrence fields `rrule`/`recurringGroupId` already on the model), dark mode + settings panel, Docker Compose deploy. Partial color-coded events. Recipe-app integrations (Mealie/Tandoor) are wired in.

⚠️ **NOT what it sounds like — there is NO authentication.** Upstream has *User Management* (profiles with name/color/avatar) but **no logins, passwords, sessions, or auth middleware** — `index.vue` itself carries a `// TODO: Authenticate user or route to login page`. Anyone on the LAN currently acts as anyone. **Auth is unbuilt and is a prerequisite for parental controls, per-kid chore check-off, reward approval, and per-person points.** See `docs/features-to-build.md`. (Audited against upstream commit `ffcd435`, 2026-04-02.)

## What we are building on top (the actual work)

Organized by phase in `docs/build-order.md`. Summary:
- **P1 Core:** points + chore tracking, rewards store, recurring chores, family message board, meal planner, dinner schedule
- **P2 Gamification:** streaks, badges, celebration screen, leaderboard
- **P3 Display/automation:** photo screensaver, sleep mode, motion wake, color-coded events, parental controls
- **Settings panel** consolidating all config (see `docs/settings-spec.md`)

## Decisions made (locked)

- **Where it runs:** the *app* runs on the Pi via Docker. **Development happens on a dev machine (Mac/PC), not on the Pi.** The Pi is headless Pi OS Lite with 4GB shared across Docker + Postgres + Node — fine for running the built stack, sluggish for a live dev loop. Because the whole thing is Docker Compose, it runs identically on a laptop and on the Pi, so we build and test locally and deploy to the Pi with `git pull && docker compose up -d`. **No Pi hardware is needed to start building** — see `docs/dev-workflow.md`.
- **Fork strategy:** vendor Skylite-UX into this repo as a fork we own (single repo, single `docker-compose.yml`). One repo to hand off and one repo another family can clone. The upstream stays a remote so we can pull fixes.
- **Calendar:** Apple iCal is our target (read-only URL pull). Note: upstream *already ships* a working Google Calendar OAuth integration too, so Google is available for free if wanted. UI lets you add/remove sources generically.
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
- Cron-style recurring logic (chore reset, leaderboard reset, sleep/wake) runs inside Docker / on the Pi — document each job.
- Keep everything LAN-safe: never add code that phones home or opens external ports by default.

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

## Status

Greenfield. Nothing built yet. Skylite-UX fork not yet cloned into this folder. Core decisions are locked (above); remaining open items in OPEN-QUESTIONS.md are feature-design details, not blockers.

## Suggested first task for Claude Code

1. Audit the live Skylite-UX repo and confirm the "already has" vs "to build" split in `docs/features-to-build.md` against reality.
2. Vendor the fork into this folder, get `docker compose up -d` running locally (no Pi needed).
3. Stand up the first-run setup wizard so the app boots family-data-free.
Then proceed by phase per `docs/build-order.md`.
