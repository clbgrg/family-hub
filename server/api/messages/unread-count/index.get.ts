import prisma from "~/lib/prisma";

/**
 * How many non-expired notes from OTHER members the session user hasn't seen
 * yet (everything counts as unread until their first visit to the board).
 * Drives the sidebar badge and the dashboard banner.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  const read = await prisma.messageRead.findUnique({ where: { userId: user.id } });
  const count = await prisma.message.count({
    where: {
      expiresAt: { gt: new Date() },
      authorId: { not: user.id },
      ...(read ? { createdAt: { gt: read.lastReadAt } } : {}),
    },
  });

  return { count };
});
