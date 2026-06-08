import prisma from "~/lib/prisma";

// Weekday (0=Sun..6=Sat) of a calendar date, computed in UTC so it's
// timezone-independent (the date string already encodes the client's day).
function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

/**
 * Chore board for a given client-local date. Returns active chores with their
 * assignee and computed `dueToday` / `done` flags. "Done" branches on
 * recurrence: ONCE = completed ever; DAILY/WEEKLY = completed on this date.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const date = String(getQuery(event).date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }
  const dow = weekdayOf(date);

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
    const done = c.recurrence === "ONCE"
      ? c._count.completions > 0
      : c.completions.length > 0;
    const dueToday = c.recurrence === "DAILY"
      ? true
      : c.recurrence === "WEEKLY"
        ? c.daysOfWeek.includes(dow)
        : !done; // ONCE: due until it's ever done

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
