import prisma from "~/lib/prisma";

/** Family Bulletin notes, newest first. Any member can read; the set is global. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  return prisma.pinnedNote.findMany({
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });
});
