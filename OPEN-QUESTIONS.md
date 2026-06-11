# Open Questions

## Resolved (see CLAUDE.md "Decisions made")

- **Where it runs / dev workflow** — develop on a dev machine, deploy Docker to the Pi. → `docs/dev-workflow.md`
- **Fork strategy** — vendor Skylite-UX as our fork, single repo. → CLAUDE.md
- **Calendar** — iCal (Apple, Google, any `.ics`, read-only) **and** Google Calendar OAuth (read-write) both already ship upstream. Support all; let each family choose. UI is already generic add/remove.
- **Family data** — fully dynamic, add/remove members; must be copyable to other families with zero code edits.
- **Hardware** — not bought; Phase 1 is procurement, build proceeds without it.
- **Day-1 scope** — do the best we can day one, then iterate.

## Still open — feature-design details (not blockers)

1. **Skylite-UX reality check.** First task: audit the live repo to confirm the "already has" vs "to build" split before planning custom work.
2. **Points-to-rewards economy.** Build fully configurable (point values, reward costs, optional weekly caps) and let each family set their own — assumed yes unless you say otherwise.
3. **Meal planner recipes.** Free-text notes first, or a structured recipe library with ingredients (needed for auto grocery-list generation)? Recommend: free-text in day-1, structured recipes as a later phase.
4. **Backups.** Add a scheduled `pg_dump` to the USB drive? Recommend yes, simple nightly job — low effort, high safety.
5. **Remote access.** Tailscale in v1 or later? Recommend later; LAN-only is simpler and safer to start.
6. **Audio.** USB speaker is optional. Chore alerts / dinner announcements in scope, or skip audio for v1? Recommend skip for day-1.
7. **Multi-family distribution.** Just "clone the GitHub repo," or do you eventually want a one-line installer script / prebuilt Docker image so non-technical families can run it? Affects how much packaging polish we invest in.
8. **Leaderboard visibility (Phase 5).** The weekly leaderboard is currently social — every member sees everyone's ranking (a kid sees a sibling at the bottom). Intended for now. Do you want a privacy toggle (hide the leaderboard, or per-kid opt-out) later, or keep it always-on? Recommend: keep social for now; revisit if it causes friction.
