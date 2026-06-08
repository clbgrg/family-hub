# Family Hub

DIY self-hosted family calendar + chore system. Raspberry Pi 5 + portable touchscreen, runs on your home WiFi. No cloud, no subscriptions. Built as a fork of [Skylite-UX](https://github.com/Wetzel402/Skylite-UX).

## Quick orientation

- **New here?** Read `CLAUDE.md`, then `docs/build-order.md`.
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

Planning complete. Skylite-UX fork vendored into this repo. Building from here per `docs/build-order.md` (next: hardened Docker compose + first-run setup, then Priority-0 auth).
