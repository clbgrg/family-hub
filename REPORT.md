# Hardening & Deploy Review — `auto/harden-and-deploy-review`

Date: 2026-06-09. Branch is off `main` @ `91f551a` (empty checkpoint commit first — the tree was clean, so there was no state to snapshot). **Not merged, not pushed.**

## TL;DR

All five parked security findings were re-verified against current code. Four needed fixes (committed, one commit per fix); the fifth (Mealie/Tandoor proxy) was already mitigated by the global auth middleware, so I locked it down with tests instead. The deploy audit found the two scary arm64 risks (Prisma engines, CRLF) **already handled**, and fixed two real operational footguns (backup failure-masking, prod restore hitting the dev compose file). A few items are deliberately left for you — listed at the bottom.

Important context discovered up front: `server/middleware/auth.ts` now session-guards **all** `/api/**` (except `/api/_*` and `/api/auth/*`). So every finding's blast radius is "any logged-in family member" rather than "any LAN device" — still worth fixing (kids' sessions, XSS pivot, stolen kiosk cookie), but less severe than when the review was written.

## Test baseline (read this before judging "tests pass")

On a **clean checkout of `main`** in this Windows environment, the suite already fails: 6 files / 55 tests (`rrule.test.ts` 44, `useTimePicker` 1, `useRecurrence` 1, `users/index.post` 4, `users/[id].delete` 3, `useCalendar` 2) — date/locale-flavored and `Object.values(Role)` mock issues, none related to this work. `npm run type-check` also has 85 pre-existing errors on clean main.

My gate was therefore **"no new failures vs. baseline"**: after every commit the failing set is byte-identical to baseline, and the pass count grew 752 → 789 (37 new tests added by this branch). Verified by saved full-run logs compared before/after. E2E project not run (needs the running stack).

## Phase 1 — security fixes (per commit)

### `6880a7f` — remove wildcard CORS from the SSE sync stream
- **Verified present:** `server/api/sync/events.get.ts:12-13` set `Access-Control-Allow-Origin: *` (+ `Allow-Headers`) on the stream of all calendar/todo/shopping data.
- **Fix:** dropped both headers — the stream is same-origin only. (Auth already blunted the original exfil PoC: with ACAO `*` browsers refuse credentialed responses, so a foreign site's `EventSource` fails the session check. Removing the headers eliminates the class.)
- **Verified by:** new test asserting no `Access-Control-*` headers are set; existing SSE tests pass.

### `d1e7022` — delete the endpoint returning the Google refresh token
- **Verified present:** `server/api/integrations/google_calendar/exchangeToken.post.ts:41` did `return { refreshToken: tokens.refresh_token }`.
- **Fix:** deleted the endpoint + its test. It is **dead code**: grep shows nothing in `app/` references `exchangeToken` or a returned `refreshToken`; the live OAuth flow is `callback.get.ts`, which stores the token server-side (`Integration.apiKey`) and only redirects.
- **Verified by:** grep for references (only its own test + docs); suite green.

### `ecd00d5` — stop returning `pinHash` from user endpoints
- **Verified present:** `server/api/users/index.get.ts:5-19` returns raw `findMany` rows (full `pinHash`) to any logged-in member; `index.post.ts:41` / `[id].put.ts:54` return raw rows too (admin-gated, but the hash still left the server).
- **Fix:** Prisma 6.9 client-level omit in `app/lib/prisma.ts` — `omit: { user: { pinHash: true } }` — so **no** query on the singleton returns the hash, including future `include: { user: ... }` joins. Login opts back in (`omit: { pinHash: false }`, `server/api/auth/login.post.ts:16`); the login picker (`auth/users.get.ts`) already used an explicit select + `hasPin` boolean and is unaffected.
- **Verified by:** type-check error count unchanged vs. main (85→85, i.e. zero new); users tests fail-set identical to baseline. Caveat: unit tests mock Prisma, so the omit itself is enforced by Prisma at the DB layer — worth one manual `curl /api/users` smoke when you next run the stack.

### `cc0dd6a` — iCal SSRF guard + timeout + no error echo
- **Verified present:** `server/api/integrations/iCal/index.get.ts:23-31` (temp mode fetches caller-supplied `baseUrl` with only a string check), `:68` (raw `error.message` returned — non-blind probe); `server/integrations/iCal/client.ts:12` (`fetch(url)`, no timeout, no `response.ok` check).
- **Fix:**
  - New `server/utils/publicUrl.ts` → `assertPublicHttpUrl()`: http(s) only; rejects `localhost`/`*.local`/`*.internal`; blocks literal **and DNS-resolved** private/reserved IPv4+IPv6 (RFC1918, loopback, link-local/169.254 incl. cloud metadata, CGNAT, multicast/reserved, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6 in both dotted and URL-normalized hex form); fails **closed** on unparseable addresses. Applied to temp **and** stored URLs in the endpoint, before any fetch.
  - Temp URLs now get the same `webcal://` normalization stored ones already had.
  - `ICalServerService` fetch: 10s `AbortSignal.timeout` + reject non-OK responses. (Kept browser-safe — the class is also bundled client-side, so the node-only DNS logic lives in the server util, not here.)
  - Endpoint catch returns a generic message instead of `error.message`.
- **Verified by:** 27-case unit suite for the guard (DNS mocked); endpoint tests for "guard rejects before fetch" and "ECONNREFUSED detail not echoed"; client tests updated + non-OK case.

### `36d3516` — Mealie/Tandoor proxy: already mitigated; locked with tests
- **Verified:** `mealie/[...path].ts` / `tandoor/[...path].ts` still attach the stored `apiKey` as a Bearer token to a client-controlled path, host-confined to the configured `baseUrl`. The review's prescribed remediation was "require auth" — that **already holds** via `server/middleware/auth.ts` (all `/api/**`).
- **Change:** no production code. Added the missing test suite for the middleware (the single guard for ~50 endpoints): non-API skip, logged-out allowlist, session required for proxy/iCal/SSE/users routes, 401 propagation, and no `/api/authx` prefix confusion.

## Phase 2 — deploy/arm64 audit

### Checked and found already correct (no change)
- **Prisma cross-build (the big arm64 risk):** builder runs on `$BUILDPLATFORM` (amd64) and its `node_modules/.prisma` is copied into the target-platform stage — that would ship amd64 engines to the Pi, **but** `prisma/schema.prisma:9` already declares `binaryTargets = ["native", "linux-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]`, so both engines are generated and the right one loads at runtime. The prod stage's global `prisma` CLI installs under QEMU per-platform, so migrate engines are native too.
- **No native npm deps** (no sharp/bcrypt/argon2; PIN hashing is nuxt-auth-utils scrypt via node:crypto) — nothing else to cross-compile.
- **Line endings:** `.gitattributes` enforces LF; `git ls-files --eol` confirms `scripts/*.sh` are `i/lf w/lf` — no Windows-checkout CRLF bomb on the Pi.
- **Images are multi-arch** for arm64: `postgres:16`, `containrrr/watchtower`, `node:20-trixie`.
- **Compose hygiene:** required secrets enforced (`:?` on `POSTGRES_PASSWORD`, `NUXT_SESSION_PASSWORD`), Postgres **not** port-published, healthcheck gates app start, Watchtower label-scoped with `--cleanup`, `.env.example` complete and accurate.
- **Workflow:** tag-only publishing, semver + `latest` tagging, QEMU+buildx correct; `workflow_dispatch` path sane.

### Fixed — `d5bf402`
- **`scripts/backup.sh` failure masking:** `pg_dump | gzip` reports the *gzip* exit status (POSIX sh, no pipefail in dash), so a failed dump (db down/bad creds) was saved as a "good" `.sql.gz` — and pruning would eventually rotate **real** backups out in favor of empty ones. Now dumps to a temp file, compresses only on success, removes both artifacts on failure. `sh -n` clean.
- **`scripts/restore.sh` prod targeting:** the script runs bare `docker compose exec`, which reads the **default** compose file — on the Pi that's the dev `docker-compose.yml`, not the running prod stack, so a prod restore fails (or worse, hits a stale dev DB if one was ever started). Documented `export COMPOSE_FILE=docker-compose.prod.yml` in the script header and in `docs/deployment.md`'s restore runbook (compose reads `COMPOSE_FILE` natively — no code change required).

## Left for you (deliberate, with reasons)

**Security (ambiguous / needs a product or key-management decision):**
1. **Secrets plaintext at rest** — `Integration.apiKey` (incl. the Google refresh token written by `callback.get.ts`) and `settings.clientSecret`. Encrypting needs a key-management decision (where does the key live on a copy-and-run family box?). Parked per your "don't guess" rule.
2. **`authCallback.post.ts` is dead code** (same grep evidence as `exchangeToken`; live flow is `callback.get.ts`). It stores the token server-side, so it's not an exposure — but it's surface you could delete in the same spirit. I removed only the endpoint named in the finding.
3. **SSRF residuals** (documented in `server/utils/publicUrl.ts`): DNS rebinding between validate and fetch, and a public URL 30x-redirecting to a private one. Closing these means pinning resolved IPs / walking redirects manually — meaningful code for a marginal LAN threat; your call.
4. **Background sync path not URL-guarded:** a logged-in user can still *store* a private iCal URL via `POST /api/integrations`, which the sync manager fetches on schedule (results visible only to authed users; errors only to logs — blind). I didn't validate at create-time because (a) Mealie/Tandoor baseUrls are *legitimately* private LAN addresses, so the guard can't be blanket-applied, and (b) a LAN-hosted `.ics` (e.g. Home Assistant) is a plausible family use case. If you want it: apply `assertPublicHttpUrl` in `integrations/index.post.ts`/`[id].put.ts` **only when `service === "iCal"`**, accepting that it kills LAN calendar feeds.
5. **Proxy depth:** members (kids) can drive credentialed Mealie/Tandoor calls — whether that should be admin-only is a product decision; session auth matches the prescribed remediation.

**Deploy (needs the actual Pi, or is a judgment call):**
6. **arm64 image still not runtime-tested** (no Pi). The engine analysis above says it should boot; first smoke: `docker compose -f docker-compose.prod.yml up -d` then check `docker logs` for Prisma "query engine" errors and complete one PIN login.
7. **App container runs as root** (node image default) and `./photos` / `./backups` bind mounts are root-owned. Adding `USER node` risks volume-permission breakage that only a real Pi run would surface.
8. **Power-cycle behavior:** daemon-level restarts don't honor `depends_on`, so the app may crash-loop briefly until Postgres is healthy — self-heals via `restart: unless-stopped`; verify once on hardware.
9. **Backups live on the same SD card** unless `./backups` is pointed at USB (docs already say to — just flagging it as the actual failure mode that matters).
10. **CI doesn't run tests before a release tag publishes an image** (review §D gap) — recommend adding the vitest job to the publish workflow as a gate.
11. The 55 baseline test failures + 85 type errors on clean main (Windows-environment flavored) are worth a look someday — they mask real regressions in local runs.

## Commits on this branch

```
4cf23b8 checkpoint: branch off main at 91f551a (empty)
6880a7f security: remove wildcard CORS from the SSE sync stream
d1e7022 security: delete exchangeToken endpoint that returned the Google refresh token to the browser
ecd00d5 security: globally omit pinHash from Prisma user query results
cc0dd6a security: guard iCal fetches against SSRF, add timeout, stop echoing upstream errors
36d3516 security: lock the API auth middleware behavior with tests
d5bf402 deploy: fix backup failure-masking and prod restore targeting the dev stack
```
