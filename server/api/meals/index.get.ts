import prisma from "~/lib/prisma";

/** Meals in a client-local date range (the visible week). Any member can view. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const q = getQuery(event);
  const start = String(q.start ?? "");
  const end = String(q.end ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw createError({ statusCode: 400, statusMessage: "start and end (YYYY-MM-DD) query params required" });
  }

  return prisma.meal.findMany({
    where: { date: { gte: start, lte: end } },
    include: { cook: { select: { id: true, name: true, avatar: true, color: true } } },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });
});
