# Skylite-UX Code Review (pre-fork) — family-hub

## Context

`family-hub` will be built by forking **Skylite-UX** (open-source family calendar/todo/shopping app: Nuxt 3 + Nitro, Prisma, PostgreSQL, Docker). Before vendoring the fork (the next build step), we reviewed the upstream codebase we're about to inherit — a **full quality pass** through Andrej Karpathy's coding-guidelines lens (simplicity, surgical changes, verifiable correctness) **plus a security audit**, and a **cross-check of the code against our own planning docs**.

Reviewed at upstream commit `ffcd435` (2026-04-02). Three Explore agents reviewed backend / frontend / tests+docs against fresh clones; the four highest-severity security findings and both architectural facts were then **verified directly against the live source** (not taken on the agents' word).

> This is a **review + remediation-sequencing** document, not a feature implementation plan. It tells us what we're inheriting, what must be fixed, and in what order relative to the fork.

---

## Verdict (TL;DR)

**Good bones; written for a trusted single user, which our use case isn't.** The data model, sync architecture (SSE + cached pulls), recurrence handling, and TypeScript discipline are genuinely solid and worth building on. The caveat: the app assumes **one trusted user on a trusted network** — there is **no authentication anywhere**, and several endpoints are reachable by any device on the LAN.

This isn't "the author's NAT'd home kiosk is being exploited today." It matters to *us* for two reasons we'd already committed to: (a) **parental controls / "parent vs. kid" roles require identity regardless** — auth is a feature prerequisite, not an add-on; and (b) our hard requirement that **any family can clone and run this** means we cannot assume a safe network. So auth + authorization is **Priority 0**, and the security findings below become a concrete hardening checklist for the fork rather than a fire alarm.

| Area | Health | One-line |
|---|---|---|
| Backend security | 🔴 Fail | No auth; SSRF; secrets leaked to client + plaintext at rest |
| Backend correctness | 🟡 OK | Mostly fine; HTTP error semantics clobbered in calendar endpoints; Prisma client not shared |
| Data model | 🟢 Good | Clean cascades, no seed data, sound recurrence model; lacks user/family scoping |
| Frontend architecture | 🟡 OK | Strong types & reuse, but 3 god-components (>850 lines), duplicated dialog logic, a shipped stub |
| Tests | 🟡 OK | ~90 test files, good API/recurrence coverage; mock-asserting, not gated in CI, zero auth/error tests |
| Docs accuracy | 🟡 OK | Auth/Google/stub corrections are right; several remaining mismatches (ports, calendar scope, Pi-specific steps) |

---

## A. Critical — security (all 4 verified against live source)

These are exploitable by **any unauthenticated device on the home WiFi**.

1. **Zero authentication on the entire API.** No sessions, no middleware, no password/PIN on `User`. `app/pages/index.vue:4` literally reads `// TODO: Authenticate user or route to login page`. Every one of the ~50 endpoints returns/mutates all users' data. *Karpathy: missing boundary entirely.* → **Priority 0, blocks everything role-based.**

2. **SSRF via iCal "temp" mode** — `server/api/integrations/iCal/index.get.ts`. When `integrationId` is `temp`/`temp-*`, the client-supplied `baseUrl` is fetched with only a `typeof === "string"` check, then the **raw `error.message` is returned to the caller** — so it's a *non-blind* SSRF probe of the home network / localhost / cloud metadata.

3. **OAuth refresh token returned to the client** — `server/api/integrations/google_calendar/exchangeToken.post.ts` does `return { refreshToken: tokens.refresh_token }`. A long-lived Google credential is handed to the browser. (Related: `authCallback.post.ts` stores it as `Integration.apiKey` in plaintext.)

4. **Wildcard CORS on an unauthenticated SSE firehose** — `server/api/sync/events.get.ts` sets `Access-Control-Allow-Origin: "*"` on a stream of all calendar/todo/shopping data. Any website the user visits can `EventSource(...)` the Pi and exfiltrate everything.

**Also security-relevant (high):**
- **Credentialed open proxy** — `mealie/[...path].ts` & `tandoor/[...path].ts` attach the stored `apiKey` as a Bearer token to a **client-controlled path** with no auth. Host is confined to the configured `baseUrl`, so not arbitrary-host SSRF, but any LAN client can drive credentialed calls against the configured service.
- **Secrets plaintext at rest** — `Integration.apiKey` and `settings.clientSecret` stored unencrypted (`prisma/schema.prisma`).
- **Default DB password + exposed port** — `docker-compose-example.yaml` / `-dev.yaml` use `POSTGRES_PASSWORD=password` and publish `5432:5432` and `3000:3000` on `0.0.0.0`. (These are example/dev compose files; our production compose must fix both.)

---

## B. Backend correctness & maintainability (Karpathy lens)

- **HTTP error semantics clobbered to 500** — `calendar-events/[id].get.ts`, `[id].put.ts`, `[id].delete.ts`, `index.post.ts` catch their own `404`/`400` and re-throw as `500: Failed to ... ${error}`. The **correct pattern already exists** in `todos/[id].put.ts` (re-throw if `"statusCode" in error`). *Fix calendar endpoints to match the todos pattern — surgical, no new code.*
- **Prisma client not shared** — a `~/lib/prisma` singleton exists but ~7 integration/iCal endpoints do `new PrismaClient()` per file. Connection-pool risk + DRY violation. *Replace with the singleton import.*
- **`${error}` interpolation** prints `[object Object]` and can leak internals; several `users/`, `todos/`, `shopping-lists/` handlers. Use `error instanceof Error ? error.message : String(error)`.
- **No fetch timeouts** on external iCal/Google/Mealie/Tandoor calls — a stalled remote hangs the request. Add `AbortController` (~10s).
- **Thin input validation** on POST/PUT bodies (no length/bounds/type guards). Prisma prevents SQL injection (no raw queries found), so this is correctness/UX, not injection — but worth a shared zod schema as we add endpoints.

**Data model (good, with gaps):** cascades correct; nullable fields reasonable; recurrence stored as `rrule` Json + `recurringGroupId` (sound, reusable for chores); **migrations carry zero seed/family data** (matches our copyable-by-other-families requirement). Gaps: **no `userId`/`familyId` scoping on any model** (needed once auth lands), and **no DB uniqueness/index for iCal dedup** on `CalendarEvent` (dedup, if any, is app-side — verify during fork).

---

## C. Frontend (Karpathy lens)

- **Shipped stub** — `app/pages/mealPlanner.vue` (32 lines) is placeholder Nuxt-UI buttons linking to nuxt/ui docs. Decide on fork: delete or build (don't ship a fake feature). Related TODO stubs in `app/integrations/integrationConfig.ts` (meal/todo integration configs).
- **God-components** — `calendar/calendarEventDialog.vue` (~2075 lines), `pages/shoppingLists.vue` (~1391), `pages/settings.vue` (~1069), `composables/useCalendar.ts` (~1212). Hard to test/modify. Decompose opportunistically *when we touch them*, not as a speculative big-bang refactor (stay surgical).
- **Duplicated dialog pattern** across 6 dialogs (`isOpen` → `watch`→`resetForm` → `emit save/close` + manual validation). Our new features (chores, rewards, message board) will repeat it → extract a `useFormDialog` composable **before** building those, so we don't multiply the duplication.
- **Optimistic updates** in page logic (shopping/todos) work but have race edges (`temp-${Date.now()}` collisions, fragile `splice` rollback, silent error toasts). Extract a `useOptimisticUpdate` helper if we lean on this for chores.
- **Strengths:** zero `any` abuse, well-typed API boundaries, good reusable globals. **Kiosk note:** pervasive `text-sm`/`text-xs` may be too small across a room — consider a kiosk font-scale setting later.

**Reusable building blocks our features should extend (not rebuild):**
- `composables/useRecurrence.ts` + `components/global/globalRecurrenceForm.vue` → **recurring chores**
- `components/global/globalList.vue` (kanban/list w/ reorder, progress) → **chore board / points list**
- `composables/useShoppingLists.ts` → template pattern for a **chores composable**
- `composables/useSyncManager.ts`, `useStableDate.ts`, `useAlertToast.ts`, `useClientPreferences.ts` → cross-cutting reuse
- `app/types/*` (database/integrations/recurrence) → stable type foundation

---

## D. Tests & CI

- ~90 test files: strong on **API endpoints** (all CRUD), **recurrence** (parameterized rrule cases), **sync manager**, **integration clients** (mocked); 10 real-HTTP e2e smoke tests.
- **Gaps:** **zero auth tests** (nothing to test yet), happy-path only (no 400/403/500, no constraint/concurrency), only **1 component test**. Several tests assert *that a mock was called* rather than real behavior.
- **CI does not run tests** — `.github/workflows/lint.yaml` runs type-check + lint only; tests don't gate PRs. `coverage/` is **committed** (stale artifact; should be gitignored).
- **Best pattern to copy for our chores/points tests:** `test/nuxt/server/api/todos/index.post.test.ts` (parameterized `.each`, proper Prisma mock, data builders, request + response assertions, timezone cases).
- **For family-hub:** add `npm run test:coverage` to CI and gate merges (~70% lines); gitignore `coverage/`.

---

## E. Doc ↔ code mismatches to fix (our repo)

The recent corrections (no-auth, Google freebie, mealPlanner stub) are **present and accurate**. Remaining fixes:

| File | Issue | Fix |
|---|---|---|
| `docs/network-security.md` | "LAN-only by default" — but compose publishes `3000:3000` on `0.0.0.0` | Note the open port; recommend `127.0.0.1:3000:3000` + reverse proxy, or a `ufw` rule scoped to the LAN subnet |
| `docs/overview.md` (L7, L23) | "Apple Calendar only" understates reality | Google Calendar OAuth (read-write, refresh token stored) + iCal (Apple/Google/any `.ics`, read-only) both ship |
| `OPEN-QUESTIONS.md` (L6) | "Apple iCal only" decision now outdated | Reframe: iCal + Google OAuth both available; let families choose |
| `docs/settings-spec.md` (L8-9, top) | Lists PIN/password as a *setting* and reads as fully-built | Add banner: target design; only Family Profiles (partial) + Calendar (partial) exist. Move PIN/password to the Priority-0 auth work |
| `docs/installation.md` (L18, 26-27) | `vcgencmd` sleep/wake presented as general steps | Label "Pi-specific (skip on dev machines)"; mirror note in `docs/dev-workflow.md` |
| `docs/network-security.md` (L20) | Tailscale | Clarify it installs on the **Pi host OS**, not in Docker |

---

## F. Recommended remediation sequence (relative to the fork)

This refines `docs/build-order.md`. **Do not start P1 chores until P0 auth exists** — points, "own chores," reward approval, and parental controls all require identity.

1. **Vendor the fork & get `docker compose up -d` running locally** (existing next step). During this, write our own `docker-compose.yml` with: no default DB password (env-required), DB **not** published to host, app bound appropriately. → *verify: app loads on `localhost:3000`, Postgres not reachable from another LAN host.*
2. **Priority 0 — Auth/authz** (the big inherited gap): PIN-based login suited to a shared kiosk, sessions, route middleware, a `role` (admin/member) + `familyId` on `User`, and query-scoping. → *verify: unauthenticated API calls are rejected; a member cannot mutate another member's data.*
3. **Security hardening of inherited endpoints** (can parallel #2): remove/guard iCal `temp` SSRF + validate URLs (block private ranges) + add fetch timeouts; stop returning the refresh token to the client and encrypt `Integration.apiKey`/secrets at rest; remove the `*` CORS on `sync/events`; require auth on the mealie/tandoor proxies. → *verify: targeted tests for each (SSRF rejected, no secret in response body, SSE rejects cross-origin).*
4. **Low-risk correctness cleanups** while in the code: fix calendar endpoints' error re-throw to match `todos`; switch to the Prisma singleton; standardize error stringification. → *verify: 404 returns 404; existing tests pass.*
5. **Extract `useFormDialog` (and maybe `useOptimisticUpdate`)** before building dialog-heavy features, to avoid multiplying duplication.
6. **CI:** add the test job + coverage gate, gitignore `coverage/`.
7. **Apply the section-E doc fixes.**
8. **Decide mealPlanner stub** (delete vs. build per `features-to-build.md`).
Then proceed into P1 (chores/points) building on the reusable blocks in section C.

---

## Verification of this review

- Architectural facts (no auth; mealPlanner 32-line stub) verified firsthand during the prior audit.
- The four critical security findings (iCal SSRF + raw error leak; refresh-token returned to client; wildcard-CORS SSE; credentialed proxy) **re-verified against raw `main` source via WebFetch** this session.
- Secondary findings (Prisma-per-file count, compose defaults, exact line numbers in lower-severity items) come from the Explore agents' reads and should be re-confirmed in-tree once the fork is vendored — none change the conclusions or the sequence above.
