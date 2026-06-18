import prisma from "~/lib/prisma";

/**
 * Unified family activity log: a reverse-chronological feed merged from every
 * timestamped, actor-bearing record — chore + school completions, decided
 * reward redemptions, manual point adjustments, board posts, and earned badges.
 *
 * Read-only. A MEMBER sees only their own activity (a passed ?userId is
 * ignored for them); an ADMIN sees the whole family, or one member via ?userId.
 */
type HistoryActor = { id: string; name: string; avatar: string | null } | null;
type HistoryEvent = {
  id: string;
  type: string;
  timestamp: Date;
  actor: HistoryActor;
  summary: string;
};

const LIMIT = 200;

function excerpt(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const isAdmin = session.user.role === "ADMIN";

  // Kids are scoped to themselves server-side regardless of any ?userId.
  const filterUserId = isAdmin
    ? (String(getQuery(event).userId ?? "") || null)
    : session.user.id;
  const userScope = filterUserId ? { userId: filterUserId } : {};

  const [chores, school, redemptions, adjustments, messages, badges, badgeDefs] = await Promise.all([
    prisma.choreCompletion.findMany({
      where: userScope,
      include: {
        chore: { select: { title: true } },
        user: { select: { id: true, name: true, avatar: true } },
        completedBy: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: LIMIT,
    }),
    prisma.schoolItemCompletion.findMany({
      where: userScope,
      include: {
        schoolItem: { select: { title: true } },
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { completedAt: "desc" },
      take: LIMIT,
    }),
    prisma.redemption.findMany({
      where: { ...userScope, status: { not: "PENDING" } },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { decidedAt: "desc" },
      take: LIMIT,
    }),
    prisma.pointAdjustment.findMany({
      where: userScope,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    // Board posts are family-wide; for a personal history show the member's own
    // posts (all of them for an unfiltered admin view).
    prisma.message.findMany({
      where: filterUserId ? { authorId: filterUserId } : {},
      include: { author: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.userBadge.findMany({
      where: userScope,
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { earnedAt: "desc" },
      take: LIMIT,
    }),
    getBadges(),
  ]);

  const badgeName = new Map(badgeDefs.map(b => [b.key, b.name]));
  const events: HistoryEvent[] = [];

  for (const c of chores) {
    const markedByOther = c.completedById && c.completedById !== c.userId;
    events.push({
      id: `chore:${c.id}`,
      type: "CHORE_COMPLETED",
      timestamp: c.completedAt,
      actor: c.user,
      summary: `completed “${c.chore?.title ?? "a chore"}” (+${c.points})${markedByOther ? ` — marked by ${c.completedBy?.name ?? "a parent"}` : ""}`,
    });
  }
  for (const s of school) {
    events.push({
      id: `school:${s.id}`,
      type: "SCHOOL_COMPLETED",
      timestamp: s.completedAt,
      actor: s.user,
      summary: `finished “${s.schoolItem?.title ?? "an assignment"}”${s.points > 0 ? ` (+${s.points})` : ""}`,
    });
  }
  for (const r of redemptions) {
    events.push({
      id: `redemption:${r.id}`,
      type: r.status === "APPROVED" ? "REDEMPTION_APPROVED" : "REDEMPTION_REJECTED",
      timestamp: r.decidedAt ?? r.requestedAt,
      actor: r.user,
      summary: `redeemed “${r.rewardName}” (${r.pointsCost} pts) — ${r.status === "APPROVED" ? "approved" : "rejected"}`,
    });
  }
  for (const a of adjustments) {
    const sign = a.delta >= 0 ? "+" : "−";
    events.push({
      id: `adjust:${a.id}`,
      type: "POINTS_ADJUSTED",
      timestamp: a.createdAt,
      actor: a.user,
      summary: `${sign}${Math.abs(a.delta)} pts — ${a.reason}${a.createdBy?.name ? ` (by ${a.createdBy.name})` : ""}`,
    });
  }
  for (const m of messages) {
    events.push({
      id: `message:${m.id}`,
      type: "MESSAGE_POSTED",
      timestamp: m.createdAt,
      actor: m.author,
      summary: `posted: “${excerpt(m.body)}”`,
    });
  }
  for (const b of badges) {
    events.push({
      id: `badge:${b.id}`,
      type: "BADGE_EARNED",
      timestamp: b.earnedAt,
      actor: b.user,
      summary: `earned the “${badgeName.get(b.badgeKey) ?? b.badgeKey}” badge`,
    });
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return events.slice(0, LIMIT);
});
