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
      // All completions' (userId, localDate) pairs: per-assignee doneToday and
      // ONCE doneEver both need them, and volume is tiny for a family.
      completions: { select: { userId: true, localDate: true } },
    },
  });

  return chores.flatMap(c =>
    c.assignments.map(({ user }) => {
      const { dueToday, done } = choreDayStatus({
        recurrence: c.recurrence,
        daysOfWeek: c.daysOfWeek,
        doneEver: c.completions.some(x => x.userId === user.id),
        doneToday: c.completions.some(x => x.userId === user.id && x.localDate === date),
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
    }),
  );
});
