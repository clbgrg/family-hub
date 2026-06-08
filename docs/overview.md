# Overview

A wall-mountable and carry-around family dashboard running on a Raspberry Pi 5 with a portable touchscreen, accessible from any phone or tablet on the home WiFi. Entirely self-hosted — no cloud accounts, no subscriptions, no data on servers you don't control.

## What it includes

- Full family calendar with Apple Calendar sync (read-only iCal pull)
- Chore tracking with points, streaks, badges, and a celebration screen
- Grocery list and meal planner
- Family message board / sticky notes
- Per-person profiles with parental controls
- Photo screensaver and time-based sleep mode
- Access from any phone or tablet on the home WiFi

## Technology stack

| Component | Details |
|---|---|
| Base software | Skylite-UX — open source, self-hosted, MIT license (github.com/Wetzel402/Skylite-UX) |
| Framework | Nuxt.js + TailwindCSS (frontend), Node.js (backend), PostgreSQL (database) |
| Deployment | Docker Compose — one command to start everything |
| Hardware | Raspberry Pi 5 (4GB) + portable HDMI touchscreen |
| Calendar sync | iCal URL pull from Apple Calendar — read-only, no Apple ID on Pi |
| Network access | LAN only by default. Tailscale VPN for optional remote access. |

## What Skylite-UX already provides

Full family calendar with month/week views; iCal URL sync (Apple, Google, any .ics); per-person user accounts with separate logins; shopping/grocery list; per-person todo lists; dark mode, font preferences, settings panel; Docker Compose deployment. Color-coded events partially implemented.
