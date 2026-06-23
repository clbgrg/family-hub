import prisma from "~/lib/prisma";

import { neglectStreak } from "../../../utils/choreBoost";

/**
 * "Missed chores": for each active recurring chore, how many scheduled due-days
 * have been skipped right now (the current neglect streak — schedule-, window-
 * and pause-aware, reusing the auto-boost walk). Surfaces what's slipping on the
 * History/Stats view. `date` is the client's local today. Any member may read.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const date = String(getQuery(event).date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }

  const chores = await prisma.chore.findMany({
    where: { active: true, recurrence: { not: "ONCE" } },
    include: { area: { select: { id: true, name: true, icon: true } } },
  });

  // Last completion per chore (before today), so the neglect walk stops there.
  const lastByChore = new Map<string, string>();
  const recurringIds = chores.map(c => c.id);
  if (recurringIds.length) {
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

  const items = chores
    .map(c => ({
      choreId: c.id,
      title: c.title,
      recurrence: c.recurrence,
      area: c.area,
      missed: neglectStreak(
        {
          recurrence: c.recurrence,
          daysOfWeek: c.daysOfWeek,
          startDate: c.startDate,
          endDate: c.endDate,
          pausedUntil: c.pausedUntil,
          createdAt: c.createdAt.toISOString().slice(0, 10),
        },
        lastByChore.get(c.id) ?? null,
        date,
      ),
    }))
    .filter(c => c.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 12);

  return { date, items };
});
