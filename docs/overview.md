# Overview

A wall-mountable and carry-around family dashboard running on a Raspberry Pi 5 with a portable touchscreen, accessible from any phone or tablet on the home WiFi. Entirely self-hosted — no cloud accounts, no subscriptions, no data on servers you don't control.

## What it includes

- Full family calendar with Apple/Google calendar sync (read-only iCal pull from any `.ics`, plus optional read-write Google Calendar OAuth)
- Chore tracking with points, streaks, badges, and a celebration screen — organized into **areas/zones**, with start/end windows, a vacation pause, rotation between kids, up-for-grabs (claimable) chores, per-chore fixed rewards, and a per-chore countdown timer
- A **stats** view (who does the most, what's getting neglected) with one-tap point boosting, plus a unified **activity history** that records "who marked it"
- Grocery list and meal planner
- Family message board / sticky notes
- A family **documents library** — upload, browse, and download files and media
- Per-person profiles with parental controls; a configurable **points label** (Stars/Bucks/…) and school **grades**
- Photo screensaver and time-based sleep mode
- Access from any phone or tablet on the home WiFi

## Technology stack

| Component | Details |
|---|---|
| Base software | Skylite-UX — open source, self-hosted, AGPL-3.0 license (github.com/Wetzel402/Skylite-UX) |
| Framework | Nuxt.js + TailwindCSS (frontend), Node.js (backend), PostgreSQL (database) |
| Deployment | Docker Compose — one command to start everything |
| Hardware | Raspberry Pi 5 (4GB) + portable HDMI touchscreen |
| Calendar sync | iCal URL pull (Apple, Google, any `.ics`) — read-only, no Apple ID on Pi. Google Calendar OAuth also available — read-write, refresh token stored in DB. |
| Network access | LAN only by default. Tailscale VPN for optional remote access. |

## What Skylite-UX already provides

Full family calendar with month/week views; iCal URL sync (Apple, Google, any .ics) plus Google Calendar OAuth; per-person **profiles** (name/color/avatar — **upstream has no login/auth**; our fork added PIN-based auth with admin/member roles as Priority 0); shopping/grocery list; per-person todo lists; dark mode, font preferences, settings panel; Docker Compose deployment. Color-coded events partially implemented.
