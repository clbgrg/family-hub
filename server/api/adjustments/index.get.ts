import prisma from "~/lib/prisma";

/**
 * List point adjustments, newest first (optionally for one member via
 * ?userId=). Any session — family transparency: kids see their deductions
 * and the reason ("-20 — fighting"), parents see the audit trail.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const userId = String(getQuery(event).userId ?? "");

  return prisma.pointAdjustment.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
});
