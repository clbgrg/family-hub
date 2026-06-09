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

- `:latest` only moves when a **release tag** is cut (see below) — not on every
  commit — so the Pi won't auto-pull an untested change.
- **Pin a version** instead of auto-updating: set `FH_IMAGE_TAG=2026.6.0` in
  `.env`. Watchtower then has nothing newer to pull.
- ⚠️ **Auto-updates apply migrations, which are forward-only (no rollback).**
  Pair this with the nightly `pg_dump` backup before trusting unattended
  updates. Restore = stop the app, restore the dump, pin `FH_IMAGE_TAG` to the
  previous release.

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

### One-time setup: make the GHCR package public

After the first publish, the image package defaults to **private**. For families
to pull it without authenticating, make it public once:
GitHub → your profile → Packages → `family-hub` → Package settings → Change
visibility → Public. (Or `gh api -X PATCH /user/packages/container/family-hub/visibility -f visibility=public`.)
