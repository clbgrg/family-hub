import prisma from "~/lib/prisma";

type Alert = { id: string; type: string; icon: string; title: string; body?: string; at: string };

/**
 * Current in-app alerts for the session user, derived on the fly (no storage —
 * alerts are inherently current and clear themselves when the underlying state
 * resolves: the event passes, the reward is decided). Role-scoped. Sources:
 *   • event reminders — upcoming events (next 24h) whose reminder window is open
 *   • reward approvals — pending requests (admin) / recently-decided (member)
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const isAdmin = user.role === "ADMIN";
  const now = new Date();
  const alerts: Alert[] = [];

  // Event reminders: events starting within 24h that carry reminder offsets,
  // surfaced once now is inside the earliest (largest) offset before the start.
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcoming = await prisma.calendarEvent.findMany({
    where: { start: { gt: now, lte: horizon }, reminders: { isEmpty: false } },
    select: { id: true, title: true, start: true, reminders: true, users: { select: { userId: true } } },
    orderBy: { start: "asc" },
  });
  for (const ev of upcoming) {
    // Family-wide events (no assignees) alert everyone; otherwise just assignees.
    const mine = isAdmin || ev.users.length === 0 || ev.users.some(u => u.userId === user.id);
    if (!mine)
      continue;
    const maxOffset = Math.max(...ev.reminders);
    if (now.getTime() < ev.start.getTime() - maxOffset * 60_000)
      continue;
    const mins = Math.round((ev.start.getTime() - now.getTime()) / 60_000);
    alerts.push({
      id: `event:${ev.id}`,
      type: "EVENT_REMINDER",
      icon: "i-lucide-calendar-clock",
      title: ev.title,
      body: mins <= 0 ? "Starting now" : mins < 60 ? `Starts in ${mins} min` : `Starts in ${Math.round(mins / 60)} h`,
      at: ev.start.toISOString(),
    });
  }

  // Reward approvals.
  if (isAdmin) {
    const pending = await prisma.redemption.findMany({
      where: { status: "PENDING" },
      select: { id: true, rewardName: true, requestedAt: true, user: { select: { name: true } } },
      orderBy: { requestedAt: "desc" },
      take: 20,
    });
    for (const r of pending) {
      alerts.push({
        id: `redemption:${r.id}`,
        type: "REDEMPTION_PENDING",
        icon: "i-lucide-gift",
        title: `${r.user.name} wants ${r.rewardName}`,
        body: "Awaiting your approval",
        at: r.requestedAt.toISOString(),
      });
    }
  }
  else {
    const since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const decided = await prisma.redemption.findMany({
      where: { userId: user.id, status: { in: ["APPROVED", "REJECTED"] }, decidedAt: { gte: since } },
      select: { id: true, rewardName: true, status: true, decidedAt: true },
      orderBy: { decidedAt: "desc" },
      take: 20,
    });
    for (const r of decided) {
      alerts.push({
        id: `redemption:${r.id}`,
        type: "REDEMPTION_DECIDED",
        icon: r.status === "APPROVED" ? "i-lucide-circle-check" : "i-lucide-circle-x",
        title: r.rewardName,
        body: r.status === "APPROVED" ? "Approved 🎉" : "Not approved",
        at: (r.decidedAt ?? now).toISOString(),
      });
    }
  }

  alerts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { alerts };
});
