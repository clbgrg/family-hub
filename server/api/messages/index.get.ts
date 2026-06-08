import prisma from "~/lib/prisma";

/** Non-expired message-board notes, newest first. Any member can read. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  return prisma.message.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });
});
