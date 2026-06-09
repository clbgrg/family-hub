# Family Hub

DIY self-hosted family calendar + chore system. Raspberry Pi 5 + portable touchscreen, runs on your home WiFi. No cloud, no subscriptions. Built as a fork of [Skylite-UX](https://github.com/Wetzel402/Skylite-UX).

## Quick orientation

- **New here?** Read `CLAUDE.md`, then `docs/build-order.md`.
- **Deploying / auto-updates?** `docs/deployment.md` (prebuilt image + Watchtower).
- **Building hardware?** `docs/hardware.md` + `docs/installation.md`.
- **Writing features?** `docs/features-to-build.md` + `docs/settings-spec.md`.
- **What we inherit from upstream?** `docs/skylite-ux-review.md`.
- **Decisions still open?** `OPEN-QUESTIONS.md`.

## Stack

Nuxt.js + TailwindCSS / Nitro server / Prisma / PostgreSQL, deployed via Docker Compose. Chromium kiosk on the Pi.

## Cost

~$250–290 required parts, ~$350–380 fully loaded. vs. Skylight commercial $300–600 + subscription.

## Relationship to Skylite-UX

This repo vendors [Skylite-UX](https://github.com/Wetzel402/Skylite-UX) (**AGPL-3.0**) as a fork we own. Because the base is AGPL-3.0 (copyleft), this fork is too — it must stay open-source, and anyone we distribute it to or who uses it over a network is owed the source. That fits our "any family can clone and run their own" model; it just rules out a closed-source or proprietary-SaaS version. The upstream history is merged in, and `upstream` remains a git remote so we can pull fixes (`git pull upstream main`). Our custom family-hub features (chores, points, rewards, gamification, message board, auth) are built on top. See `docs/skylite-ux-review.md` for a full audit of the inherited code and `docs/build-order.md` for the plan.

## Status

**Feature-complete and running in Docker.** Built and verified: first-run setup + PIN auth, calendar, per-person chores with points, gamification (streaks/badges/celebration/leaderboard), meal planner + grocery generation, family message board, rewards store, a Today dashboard, a parent-controlled settings panel (roles/PINs), and a photo screensaver with QR access. Badges and rewards are admin-editable. Ops: a GHCR auto-update pipeline (release tag → image → Watchtower) and a scheduled DB backup with a verified restore.

What remains is not code: buy the Raspberry Pi 5 and deploy (`git pull && docker compose -f docker-compose.prod.yml up -d`), and flip the GHCR package public to enable auto-updates. The arm64 image has not been runtime-tested yet (no Pi). See `docs/deployment.md`.
