# Hardening & Deploy Review — `auto/harden-and-deploy-review`

Date: 2026-06-09, two passes (initial review + "go ahead with all recommended actions"). Branch is off `main` @ `91f551a`. **Not merged, not pushed.**

## TL;DR

All five parked security findings are fixed or locked with tests, plus the follow-up hardening from the first pass's "left for you" list: dead OAuth endpoints deleted, redirects validated hop-by-hop, stored iCal URLs guarded at the source (with an `.env` escape hatch), and releases are now **gated on tests in CI**. Deploy audit fixed two operational footguns (backup failure-masking, prod restore targeting the dev stack). The test suite is **841/841 green and `type-check` is 0 errors** — the "55 pre-existing failures / 85 type errors" I reported mid-work turned out to be environment artifacts (machine timezone + ungenerated Prisma client + a network-dependent test), all root-caused and fixed for good.

Context that shaped severity: `server/middleware/auth.ts` session-guards all `/api/**`, so every finding's blast radius was "any logged-in family member," not "any LAN device."

## Commits (in order)

```
4cf23b8 checkpoint: branch off main at 91f551a (empty — tree was clean)
6880a7f security: remove wildcard CORS from the SSE sync stream
d1e7022 security: delete exchangeToken endpoint that returned the Google refresh token to the browser
ecd00d5 security: globally omit pinHash from Prisma user query results
cc0dd6a security: guard iCal fetches against SSRF, add timeout, stop echoing upstream errors
36d3516 security: lock the API auth middleware behavior with tests
d5bf402 deploy: fix backup failure-masking and prod restore targeting the dev stack
9e3c5f5 docs: REPORT.md (first-pass version)
11e2589 security: delete dead authCallback Google OAuth endpoint
541c8de security: validate redirects hop-by-hop and guard stored iCal URLs at the source
58e7161 ci: gate releases on tests; make the suite deterministic (841/841 green)
142b4eb docs: clear remaining stale auth-status notes (review section E spirit)
```

## Phase 1 — the five parked findings

### `6880a7f` — wildcard CORS on the SSE stream
**Verified at** `server/api/sync/events.get.ts:12-13`; removed both `Access-Control-*` headers (stream is same-origin only). Regression test asserts no CORS headers are set.

### `d1e7022` + `11e2589` — OAuth refresh-token exposure
`exchangeToken.post.ts:41` returned `tokens.refresh_token` to the browser. Both it and `authCallback.post.ts` are dead code (grep: nothing in `app/` references either; the live flow is `callback.get.ts`, which keeps the token server-side). Both deleted with their tests.

### `ecd00d5` — `pinHash` in `/api/users` responses
`users/index.get.ts` returned raw `findMany` rows (hash included) to any logged-in member. Fixed with a Prisma client-level `omit: { user: { pinHash: true } }` in `app/lib/prisma.ts` — covers every query incl. future `include: { user: ... }` joins. Login opts back in via `omit: { pinHash: false }`; the login picker already used an explicit select + `hasPin` boolean.

### `cc0dd6a` + `541c8de` — iCal SSRF (now closed end-to-end)
Original hole: temp mode fetched any caller-supplied URL and echoed the raw error (non-blind LAN/metadata probe), no timeout.
- `server/utils/publicUrl.ts` → `assertPublicHttpUrl()`: http(s) only; rejects `localhost`/`*.local`/`*.internal`; blocks literal and DNS-resolved private/reserved IPv4+IPv6 (RFC1918, loopback, link-local/metadata 169.254, CGNAT, multicast/reserved, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6 in dotted *and* URL-normalized hex form); fails closed on unparseable addresses.
- `fetchPublicText()` fetches with `redirect: "manual"` in a bounded loop (max 5 hops) and validates **every hop** — closes the redirect-to-private bypass. The iCal endpoint uses it; `ICalServerService` gained a `parseEvents()` split (its own `fetchEventsFromUrl` unchanged for the browser path, but with a 10s timeout + non-OK rejection).
- Stored URLs are guarded **at the source**: integration create/update (admin-only) reject private iCal `baseUrl`s (case-insensitive service match), covering the unattended sync-manager fetch path. Mealie/Tandoor stay exempt — their LAN baseUrls are legitimate.
- `FH_ALLOW_PRIVATE_URLS=true` escape hatch (`.env.example`, both compose files) for families hosting their own LAN feeds (e.g. Home Assistant `.ics`).
- Endpoint errors: own guard errors pass through (safe messages); network/parse failures return a generic message.
- **Accepted residual:** DNS rebinding between validation and fetch (needs resolved-IP pinning via a custom dispatcher; out of proportion for a LAN kiosk).

### `36d3516` — Mealie/Tandoor credentialed proxy
The prescribed remediation ("require auth") already held via the global middleware; no production change. Added the middleware's first test suite (allowlist boundaries, 401 propagation, no `/api/authx` prefix confusion). Member (kid) access to the proxies is intentional — shopping lists are member-facing.

## Phase 2 — deploy/arm64 audit

**Verified already correct (no change needed):** Prisma cross-build is safe — `schema.prisma` declares `binaryTargets = ["native", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]`, so the amd64 builder emits arm64 engines and the QEMU-built production stage installs a native CLI. No native npm deps. `.gitattributes` forces LF on scripts (no CRLF bomb). `postgres:16`/Watchtower/node images are arm64 multi-arch. Compose enforces required secrets, doesn't publish Postgres, healthchecks the DB, label-scopes Watchtower. `.env.example` complete.

**Fixed `d5bf402`:**
- `scripts/backup.sh`: `pg_dump | gzip` reported gzip's exit status, so a failed dump was saved as a "good" backup and pruning would eventually rotate real backups out in favor of empty ones. Now dumps to a temp file and compresses only on success.
- `scripts/restore.sh` on the Pi would `docker compose exec` into the **dev** compose project. Documented `export COMPOSE_FILE=docker-compose.prod.yml` in the script header and `docs/deployment.md` runbook.

## CI & test determinism (`58e7161`) — and a correction

Mid-review I reported the suite had "55 pre-existing failures + 85 type errors on clean main." Root-causing them (required before gating releases on tests) showed **none were real**:
- 46 were machine-timezone-dependent (rrule/recurrence/time-picker assert wall-clock values). Fixed by pinning `TZ=UTC` in `vitest.config.ts` — deterministic on any machine.
- 7 (+ all 85 type errors) appear only on a checkout where `prisma generate` never ran (the `Role` enum is undefined). My fresh worktree hit this; your working copy wouldn't. CI now generates explicitly.
- 2 `useCalendar` boundary tests depended on a **network** timezone fetch (`tz.add-to-calendar-technology.com`, currently 500ing) and silently degraded to UTC-day comparison. Now they register a static CST `VTIMEZONE` fixture — deterministic offline.

Result: **82 files / 841 tests, 0 failures; `npm run type-check` 0 errors.**

Workflows: `publish-image.yaml` has a `Tests (release gate)` job that `build-and-push` needs — a release tag with failing tests can no longer reach GHCR/Watchtower/the Pi. `lint.yaml` got the same test job plus a `push: main` trigger (it previously only ran on PRs, which this repo doesn't use).

## Doc fixes (`142b4eb`)

Most §E items were already done on main. Cleared the three stale spots that still described auth/settings as unbuilt (`docs/overview.md`, `docs/settings-spec.md` banner, `docs/network-security.md`), and documented `FH_ALLOW_PRIVATE_URLS`.

## Deliberately not done (with reasons)

1. **Secrets encryption at rest** (`Integration.apiKey` incl. the Google refresh token, `settings.clientSecret`): on a Pi, the encryption key would live in `.env` on the same SD card as the database — near-zero real protection for meaningful migration/restore complexity (and key rotation would brick stored tokens). If you want it anyway, the decision needed is where the key lives; say the word.
2. **DNS-rebinding pinning** — see the accepted residual above.
3. **Admin-only recipe proxies** — would break member-facing shopping lists; current session-auth matches the prescribed remediation.
4. **Pi-dependent items** (unchanged from pass 1): arm64 runtime smoke test, root-user/volume permissions (`USER node` risks breaking the `./photos` bind mount), power-cycle crash-loop-until-db-healthy behavior, pointing `./backups` at USB. First boot on hardware: `docker compose -f docker-compose.prod.yml up -d`, check logs for Prisma engine errors, complete one PIN login, confirm a backup file appears.
5. **Coverage-threshold gating** — the gate runs the full suite but doesn't enforce a % line; calibrate one later if you want (`npm run test:coverage` works).

## Verification summary

After every commit: full `vitest run --project unit --project nuxt` (now 841/841), eslint on all touched files (0 errors; only "file ignored" warnings for test paths outside lint scope), `sh -n` on both shell scripts, `npm run type-check` (0 errors), and `git status` clean. E2E project not run (needs the running stack). The CI workflows themselves can't be exercised locally — first push/tag will prove them; if the gate ever misfires, the jobs are plain `npm ci && prisma generate && nuxt prepare && vitest run`.
