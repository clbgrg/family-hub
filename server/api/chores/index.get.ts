import prisma from "~/lib/prisma";

/**
 * Chore board for a given client-local date. A chore may have several
 * assignees (each does their own copy), so the board expands to ONE ROW PER
 * (chore × assignee) with that assignee's own `dueToday` / `done` flags.
 * `assigneeIds` carries the full assignment list for the edit dialog.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const date = String(getQuery(event).date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }

  const chores = await prisma.chore.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      area: { select: { id: true, name: true, icon: true, order: true } },
      reward: { select: { id: true, name: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, avatar: true, color: true, todoOrder: true } } },
      },
      // Only TODAY's completions — doneEver (which needs history) only matters
      // for ONCE chores, fetched separately below so the board query stays
      // bounded as completion history grows. user is for claimable "claimed by".
      completions: { where: { localDate: date }, select: { userId: true, user: { select: { name: true } } } },
    },
  });

  // Per-assignee doneEver for ONCE chores.
  const onceIds = chores.filter(c => c.recurrence === "ONCE").map(c => c.id);
  const everDone = onceIds.length
    ? await prisma.choreCompletion.findMany({
        where: { choreId: { in: onceIds } },
        select: { choreId: true, userId: true },
      })
    : [];
  const everDoneOnce = new Set(everDone.map(e => `${e.choreId}:${e.userId}`));
  const everDoneOnceByChore = new Set(everDone.map(e => e.choreId)); // any claimer (claimable ONCE)

  // Auto point-boost: when enabled, neglected recurring chores carry an
  // escalating bonus derived from each chore's most recent completion before
  // today (any assignee — it's the chore that's neglected, not a person).
  const boostOn = await getBoolSetting("autoBoostEnabled");
  const recurringIds = chores.filter(c => c.recurrence !== "ONCE").map(c => c.id);
  const lastByChore = new Map<string, string>();
  if (boostOn && recurringIds.length) {
    const lastRows = await prisma.choreCompletion.groupBy({
      by: ["choreId"],
      where: { choreId: { in: recurringIds }, localDate: { lt: date } },
      _max: { localDate: true },
    });
    for (const r of lastRows) {
      if (r._max.localDate)
        lastByChore.set(r.choreId, r._max.localDate);
    }
  }

  return chores.flatMap((c) => {
    const doneToday = new Set(c.completions.map(x => x.userId));
    // Stable assignee order (family member order) for rotation.
    const assignees = c.assignments
      .map(a => a.user)
      .sort((a, b) => a.todoOrder - b.todoOrder || a.name.localeCompare(b.name));
    // A rotating chore shows only the on-duty assignee for the day; the others'
    // copies are hidden until their turn comes round. Claimable overrides
    // rotation — the whole pool sees it until someone grabs it.
    const onDuty = c.rotate && !c.claimable && assignees.length > 1
      ? [assignees[rotationIndex(c.recurrence, date, assignees.length)]!]
      : assignees;

    // Claimable chores share ONE completion across the pool (first-come), so the
    // done state and claimer are the same on every assignee's row.
    const claimerName = c.claimable && c.completions.length > 0 ? (c.completions[0]!.user?.name ?? null) : null;
    const claimerId = c.claimable && c.completions.length > 0 ? c.completions[0]!.userId : null;

    // Per-chore neglect bonus (same for every assignee row); only meaningful on
    // a row that's actually due-and-undone, applied per row below.
    const choreBoost = boostOn
      ? computeBoost(
          { recurrence: c.recurrence, daysOfWeek: c.daysOfWeek, startDate: c.startDate, endDate: c.endDate, pausedUntil: c.pausedUntil, createdAt: c.createdAt.toISOString().slice(0, 10) },
          lastByChore.get(c.id) ?? null,
          date,
        )
      : 0;

    return onDuty.map((user) => {
      const claimedToday = c.claimable ? c.completions.length > 0 : doneToday.has(user.id);
      const doneEver = c.claimable
        ? (c.completions.length > 0 || everDoneOnceByChore.has(c.id))
        : (doneToday.has(user.id) || everDoneOnce.has(`${c.id}:${user.id}`));

      const { dueToday, done } = choreDayStatus({
        recurrence: c.recurrence,
        daysOfWeek: c.daysOfWeek,
        doneEver,
        doneToday: claimedToday,
        localDate: date,
        startDate: c.startDate,
        endDate: c.endDate,
        pausedUntil: c.pausedUntil,
      });

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        points: c.points,
        recurrence: c.recurrence,
        daysOfWeek: c.daysOfWeek,
        order: c.order,
        area: c.area,
        startDate: c.startDate,
        endDate: c.endDate,
        pausedUntil: c.pausedUntil,
        rotate: c.rotate,
        claimable: c.claimable,
        wheelEligible: c.wheelEligible,
        claimedBy: claimerName,
        claimedById: claimerId,
        reward: c.reward,
        assignee: user,
        assigneeIds: c.assignments.map(a => a.userId),
        dueToday,
        done,
        boost: dueToday && !done ? choreBoost : 0,
      };
    });
  });
});
