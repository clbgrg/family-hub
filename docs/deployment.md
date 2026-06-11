# Deployment & auto-updates

Two ways to run Family Hub:

| | Build from source | Prebuilt image (recommended for the Pi) |
|---|---|---|
| Command | `docker compose up -d` | `docker compose -f docker-compose.prod.yml up -d` |
| Where the build happens | On the device (slow on a 4 GB Pi) | In GitHub CI (multi-arch, incl. arm64) |
| Auto-updates | No (manual `git pull`) | Yes — Watchtower pulls new release images |

## Prebuilt image + auto-updates (the Pi path)

`docker-compose.prod.yml` pulls `ghcr.io/clbgrg/family-hub:latest` and runs
[Watchtower](https://containrrr.dev/watchtower/), which checks hourly and, when a
**new release image** is published, pulls it and restarts the app. The app runs
`prisma migrate deploy` on start, so a schema change ships with the update.

```bash
git clone https://github.com/clbgrg/family-hub.git
cd family-hub
cp .env.example .env        # set POSTGRES_PASSWORD + NUXT_SESSION_PASSWORD
docker compose -f docker-compose.prod.yml up -d
```

Also set `APP_PUBLIC_URL=http://<pi-lan-ip>:3000` in `.env` — it's what the
Settings → Network & Access QR code encodes. Inside Docker the app can't detect
the Pi's LAN address, so without it the QR section shows setup guidance instead
of a scannable code.

- `:latest` only moves when a **release tag** is cut (see below) — not on every
  commit — so the Pi won't auto-pull an untested change.
- **Pin a version** instead of auto-updating: set `FH_IMAGE_TAG=2026.6.0` in
  `.env`. Watchtower then has nothing newer to pull.
- ⚠️ **Auto-updates apply migrations, which are forward-only (no rollback).**
  The `backup` sidecar (below) is the safety net — keep it running before you
  trust unattended updates.

## Backups & restore

Both compose files include a `backup` sidecar that runs `pg_dump` on start and
then every `BACKUP_INTERVAL_SECONDS` (default daily), writing gzipped dumps to
`./backups/` and keeping the newest `BACKUP_KEEP` (default 7). On the Pi, point
`./backups` at a USB drive. Dumps are `--clean`, so restoring one overwrites
whatever's currently in the database.

**Restore** (e.g. after a bad auto-update):

```bash
export COMPOSE_FILE=docker-compose.prod.yml     # prod only — without this, every
                                                # command below (including the
                                                # script) targets the dev stack
docker compose stop app
scripts/restore.sh backups/family-hub-YYYYMMDD-HHMMSS.sql.gz
docker compose up -d
```

If a release itself is bad, also pin `FH_IMAGE_TAG` to the previous version so
Watchtower doesn't immediately re-pull the broken one.

## Cutting a release (maintainer)

Publishing happens via `.github/workflows/publish-image.yaml`, which triggers
**only on `v*` tags**:

```bash
# from an up-to-date main
git tag v2026.6.0
git push origin v2026.6.0
```

The Action builds `linux/amd64,linux/arm64` and pushes
`ghcr.io/clbgrg/family-hub:2026.6.0` **and** `:latest`. Within the hour, every
Pi tracking `:latest` updates itself.

You can also run it manually (Actions → "Publish image" → Run workflow) with an
explicit tag.

### GHCR package visibility

The `family-hub` package on GHCR is **public** (verified 2026-06-10: anonymous
pulls work). If it ever needs changing, use the web UI — GitHub → your profile
→ Packages → `family-hub` → Package settings → Change visibility. (There is NO
REST endpoint for package visibility; `gh api` returns 404.)
