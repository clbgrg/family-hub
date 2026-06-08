import prisma from "~/lib/prisma";

/**
 * Chore board for a given client-local date. Returns active chores with their
 * assignee and computed `dueToday` / `done` flags (via the shared
 * choreDayStatus predicate, also used by the completion all-done check).
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
      assignee: { select: { id: true, name: true, avatar: true, color: true } },
      completions: { where: { localDate: date } },
      _count: { select: { completions: true } },
    },
  });

  return chores.map((c) => {
    const { dueToday, done } = choreDayStatus({
      recurrence: c.recurrence,
      daysOfWeek: c.daysOfWeek,
      doneEver: c._count.completions > 0,
      doneToday: c.completions.length > 0,
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
      assignee: c.assignee,
      dueToday,
      done,
    };
  });
});
