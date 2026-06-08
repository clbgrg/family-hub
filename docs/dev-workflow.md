# Dev Workflow

## Where to develop: dev machine, not the Pi

Run Claude Code and the dev loop on your **Mac/PC**, deploy the built stack to the **Pi**.

Why not develop directly on the Pi:
- Pi 5 (4GB) is headless Pi OS Lite. Running Postgres + Node + a live Nuxt dev server with hot reload, *plus* Claude Code, on 4GB of shared ARM memory is slow and can thrash.
- You don't have the Pi yet, and you shouldn't have to wait for hardware to start building.

Why this works cleanly:
- The whole app is Docker Compose, so it runs **identically** on an x86 laptop and on the ARM Pi. What you test locally is what runs on the Pi.
- Develop fast locally → push to the repo → on the Pi: `git pull && docker compose up -d`.

You'll still SSH into the Pi for the device-specific bits that can't run on a laptop: Chromium kiosk autostart, the `vcgencmd display_power` sleep/wake cron jobs, the static-IP setup, and (optional) the PIR motion sensor on GPIO. Those live in `docs/installation.md`.

## Local loop

1. Clone this repo on your dev machine.
2. `cp .env.example .env`, fill in a dev DB password, secret key, port 3000.
3. `docker compose up` (foreground, so you see logs) — open `http://localhost:3000`.
4. Build features, commit per phase (`docs/build-order.md`).

## Deploy to the Pi

1. One-time Pi setup: `docs/installation.md` steps 1-3 (flash, SSH, Docker).
2. `git clone` this repo on the Pi, copy `.env`, set a real DB password + port.
3. `docker compose up -d`.
4. Updates thereafter: `git pull && docker compose up -d --build`.
5. Device polish: kiosk autostart + sleep/wake cron (`docs/installation.md` steps 9-10).

## Building for other families (copy-and-run)

This is a hard requirement: another family clones the repo and runs their own instance with **zero code edits**.

- Ship **no family data** in source, migrations, or seed files.
- A fresh `docker compose up` boots to a **first-run setup wizard**: create admin, add members, assign colors, paste an iCal URL.
- All instance config lives in `.env` (secrets, ports) and the Settings UI (everything else).
- `.env.example` documents every variable with safe defaults.
- A short "Set up your own Family Hub" section in the README is the only thing a new family should need.
- Acceptance test for any feature: *could a different family use this without touching the code?* If no, it's not done.
