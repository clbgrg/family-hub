import prisma from "~/lib/prisma";

/**
 * Chore analytics over a trailing window (default 30 days), for the stats page:
 * who completes the most, completions by area, and the least-completed active
 * recurring chores ("needs attention" — the candidates for a points boost).
 * `date` is the client's local today; the window is the N days ending on it.
 */
const WINDOW_DAYS = 30;

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const date = String(getQuery(event).date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }
  const since = addDays(date, -(WINDOW_DAYS - 1));

  const [users, chores, completions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, avatar: true, color: true } }),
    prisma.chore.findMany({ include: { area: { select: { id: true, name: true, icon: true } } } }),
    prisma.choreCompletion.findMany({
      where: { localDate: { gte: since } },
      select: { choreId: true, userId: true, points: true },
    }),
  ]);
  const choreById = new Map(chores.map(c => [c.id, c]));

  // Who does the most (completions + points earned in the window).
  const byUser = new Map<string, { completions: number; points: number }>();
  const byChore = new Map<string, number>();
  const byArea = new Map<string, { areaId: string | null; name: string; icon: string | null; completions: number }>();
  for (const c of completions) {
    const u = byUser.get(c.userId) ?? { completions: 0, points: 0 };
    u.completions++;
    u.points += c.points;
    byUser.set(c.userId, u);

    byChore.set(c.choreId, (byChore.get(c.choreId) ?? 0) + 1);

    const area = choreById.get(c.choreId)?.area ?? null;
    const key = area?.id ?? "__none__";
    const a = byArea.get(key) ?? { areaId: area?.id ?? null, name: area?.name ?? "No area", icon: area?.icon ?? null, completions: 0 };
    a.completions++;
    byArea.set(key, a);
  }

  const perUser = users
    .map(u => ({ userId: u.id, name: u.name, avatar: u.avatar, color: u.color, ...(byUser.get(u.id) ?? { completions: 0, points: 0 }) }))
    .sort((a, b) => b.completions - a.completions);

  const areas = [...byArea.values()].sort((a, b) => b.completions - a.completions);

  // Needs attention: active recurring chores done the least in the window.
  const neglected = chores
    .filter(c => c.active && c.recurrence !== "ONCE")
    .map(c => ({
      choreId: c.id,
      title: c.title,
      points: c.points,
      recurrence: c.recurrence,
      area: c.area,
      completions: byChore.get(c.id) ?? 0,
    }))
    .sort((a, b) => a.completions - b.completions)
    .slice(0, 10);

  return { windowDays: WINDOW_DAYS, since, perUser, byArea: areas, neglected };
});
