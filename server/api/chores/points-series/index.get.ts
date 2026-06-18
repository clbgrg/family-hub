import prisma from "~/lib/prisma";

import { addDays } from "../../../utils/choreSchedule";

/**
 * Chore points earned per day over a trailing window, for the History chart.
 * Returns one series per member (so the client can show per-member lines or a
 * combined family total) aligned to a shared date axis. `date` is the client's
 * local today; the window is the N days ending on it.
 *
 * Role-scoped like the activity feed: a MEMBER only ever gets their own series
 * (any ?userId is ignored); an ADMIN gets every member, or one via ?userId.
 */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const isAdmin = session.user.role === "ADMIN";

  const q = getQuery(event);
  const date = String(q.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) query param required" });
  }
  const days = Math.min(MAX_DAYS, Math.max(1, Number.parseInt(String(q.days), 10) || DEFAULT_DAYS));
  const since = addDays(date, -(days - 1));

  const filterUserId = isAdmin ? (String(q.userId ?? "") || null) : session.user.id;

  const [users, completions] = await Promise.all([
    prisma.user.findMany({
      where: filterUserId ? { id: filterUserId } : {},
      select: { id: true, name: true, color: true },
      orderBy: [{ todoOrder: "asc" }, { name: "asc" }],
    }),
    prisma.choreCompletion.findMany({
      where: { localDate: { gte: since, lte: date }, ...(filterUserId ? { userId: filterUserId } : {}) },
      select: { userId: true, localDate: true, points: true },
    }),
  ]);

  // Inclusive date axis: since … date.
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(addDays(since, i));
  const dateIndex = new Map(dates.map((d, i) => [d, i]));

  // Per-user, per-day point sums (frozen ChoreCompletion.points, incl. boosts).
  const byUser = new Map<string, number[]>();
  for (const u of users) byUser.set(u.id, Array.from({ length: days }, () => 0));
  for (const c of completions) {
    const arr = byUser.get(c.userId);
    const idx = dateIndex.get(c.localDate);
    if (arr && idx !== undefined)
      arr[idx] = (arr[idx] ?? 0) + c.points;
  }

  const series = users.map(u => ({
    userId: u.id,
    name: u.name,
    color: u.color,
    points: byUser.get(u.id)!,
  }));

  return { since, days, dates, series };
});
