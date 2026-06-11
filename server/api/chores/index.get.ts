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
      assignments: {
        include: { user: { select: { id: true, name: true, avatar: true, color: true } } },
      },
      // Only TODAY's completions — doneEver (which needs history) only matters
      // for ONCE chores, fetched separately below so the board query stays
      // bounded as completion history grows.
      completions: { where: { localDate: date }, select: { userId: true } },
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

  return chores.flatMap((c) => {
    const doneToday = new Set(c.completions.map(x => x.userId));
    return c.assignments.map(({ user }) => {
      const { dueToday, done } = choreDayStatus({
        recurrence: c.recurrence,
        daysOfWeek: c.daysOfWeek,
        doneEver: doneToday.has(user.id) || everDoneOnce.has(`${c.id}:${user.id}`),
        doneToday: doneToday.has(user.id),
        localDate: date,
      });

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        points: c.points,
        recurrence: c.recurrence,
        daysOfWeek: c.daysOfWeek,
        order: c.order,
        assignee: user,
        assigneeIds: c.assignments.map(a => a.userId),
        dueToday,
        done,
      };
    });
  });
});
