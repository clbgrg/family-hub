# Features to Build on Top of Skylite-UX

> **Audited against upstream commit `ffcd435` (2026-04-02).** Findings folded into the tables below. The one structural surprise: **Skylite-UX has no authentication** — see Priority 0.

> **Status (2026-06): the app is feature-complete and running; the tables below are the original pre-build plan, kept for history.** Priority 0–3 are all built and on `main`. A later June 2026 batch (branch `feat/areas-history-scheduling`, pushed, unmerged) added: chore **areas/zones**; **who-marked + a unified activity history**; advanced chore **scheduling** (start/end window, vacation pause, deterministic rotation, up-for-grabs/claimable, per-chore fixed rewards); a **stats** page (who does what / what's neglected) + manual point-boost; **household config** (configurable points label + grade scale, plus school-item grades); and a family **documents library** (upload/download/delete on a Docker volume). Deferred from that batch: dashboard configuration (per-device toggle) and message attachments. See `CLAUDE.md` for the current state.

## Priority 0 — Authentication (prerequisite, not optional)

Upstream ships *User Management* (profiles) but **no login/auth**: no password or PIN on the `User` model, no sessions, no auth middleware, no login page (`index.vue` has a literal `// TODO: Authenticate user or route to login page`). Everything below that says "per-person," "own chores," "parent approves," or "admin vs member" depends on identity that doesn't exist yet.

| Feature | How to build | Effort |
|---|---|---|
| User auth + sessions | Add password/PIN to `User`, session handling, a login page, and route middleware. PIN-on-a-shared-touchscreen UX (not email/password) likely fits the Pi kiosk best. | **Large — build first** |

> This reclassifies **Parental Controls** (below): it was rated "Medium" assuming roles exist; in reality it's auth + a `role` field + enforcement, and is gated on this Priority 0 work.

## Priority 1 — Core family features

| Feature | How to build | Effort |
|---|---|---|
| Points + chore tracking | Add points column to chores table. Track completions per user. Show running totals on dashboard. | Medium |
| Rewards store | New DB table `rewards` (name, cost_pts, image). Parent creates; kids redeem; parent approves via notification. | Medium |
| Recurring chores | Add recurrence field (daily/weekly/custom). Cron job inside Docker resets completions at midnight. **Reuse:** `Todo` already has `rrule` (JSON) + `recurringGroupId` — mirror that pattern for chores. | Medium |
| Family message board | Sticky-note posts per user, color-coded by member. Auto-expire after 7 days or manual delete. | Easy |
| Meal planner | 7-day grid UI. Drag recipes into slots. Auto-generate grocery list from ingredients. **Note:** a stub page already exists (`app/pages/mealPlanner.vue`, ~32 lines of placeholder) and Mealie/Tandoor recipe integrations are wired in — build on those, don't start from zero. | Medium |
| Dinner schedule | Subset of meal planner — dinner slot with who is cooking and what time. | Easy |

## Priority 2 — Gamification

| Feature | How to build | Effort |
|---|---|---|
| Chore streaks | Track consecutive days of completion per user. Store `streak_count`, `last_completed_date`. | Easy |
| Badges / achievements | Badge table with unlock conditions (streak >= 7, total_pts >= 100). Check on each completion. | Medium |
| Celebration screen | When all chores for a user are done, full-screen animation: confetti, streak, badges earned. | Easy |
| Leaderboard | Weekly points ranking on dashboard. Resets Sunday midnight via cron. | Easy |

## Priority 3 — Display & automation

| Feature | How to build | Effort |
|---|---|---|
| Photo screensaver | After N min idle, fullscreen slideshow from `/photos`. Browser-side JS. | Easy |
| Sleep mode | Cron: `vcgencmd display_power 0` at bedtime, `display_power 1` at wake. Configurable in Settings. | Easy |
| Motion wake (optional) | Python script reads PIR sensor GPIO. On motion, runs `display_power 1`. | Medium |
| Color-coded events | Assign a color per family member; their events inherit it. Partially in Skylite-UX. | Easy |
| Parental controls | Roles: admin (parents) vs member (kids). Admins edit/delete anything; members only check off own chores. | Medium |

---

## Detailed feature specs

### Celebration screen

When all of a user's chores are completed for the day, the app auto-switches to a full-screen celebration:

- A completion check runs after every chore is checked off.
- If all chores for that user = done, navigate to `/celebrate/[username]`.
- The page shows: confetti animation, name, points earned today, current streak, any badges just unlocked.
- Auto-dismiss after 10 seconds, return to dashboard.

Example content: "Amazing work, Alex! | All 4 chores done | 45 points earned today | 7-day streak! | New badge unlocked: Clean Machine | [confetti]"

### Badges & streaks

Store badges in the DB and check unlock conditions on each chore completion.

| Badge | Unlock condition | Display |
|---|---|---|
| Hot Streak | 7 days in a row with all chores done | Flame icon + orange glow |
| Speed Demon | All chores done before noon | Lightning bolt + yellow |
| All-Star | 100+ points earned in one day | Gold star + burst animation |
| Perfect Week | All chores every day for 7 days | Bullseye + green checkmarks |
| Clean Machine | 30 total chores completed | Broom + blue badge |
| Champion | Top leaderboard for a month | Crown + purple border |

### Family message board

A sticky-note-style board on the dashboard:

- Any logged-in family member can post.
- Messages auto-expire after 7 days, or a parent can delete any message.
- Appear in a scrollable strip on the main dashboard.
- Color matches the user's assigned family color.
- Large font on the Pi screen — readable across the room.

### Meal planner

A weekly grid (7 days x 3 meals). Each cell holds a recipe or free-text note:

- Parents plan the week's meals in advance.
- Clicking a meal slot shows the full recipe.
- "Auto-generate grocery list" scans all planned meals and compiles a shopping list.
- The dinner slot also shows on the main calendar view for that day.
