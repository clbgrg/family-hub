import prisma from "~/lib/prisma";

/**
 * School items for a date range, PLUS incomplete items from before the range
 * (overdue carry-forward — an unfinished assignment keeps showing until done
 * or deleted). Returns done/completedAt per item.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const q = getQuery(event);
  const start = String(q.start ?? "");
  const end = String(q.end ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw createError({ statusCode: 400, statusMessage: "start and end (YYYY-MM-DD) query params required" });
  }

  const items = await prisma.schoolItem.findMany({
    where: {
      OR: [
        { dueDate: { gte: start, lte: end } },
        { dueDate: { lt: start }, completions: { none: {} } },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: { completions: { select: { localDate: true, completedAt: true } } },
  });

  return items.map(i => ({
    id: i.id,
    title: i.title,
    description: i.description,
    points: i.points,
    grade: i.grade,
    dueDate: i.dueDate,
    userId: i.userId,
    done: i.completions.length > 0,
    completedAt: i.completions[0]?.completedAt ?? null,
  }));
});
