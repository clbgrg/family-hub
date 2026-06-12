import prisma from "~/lib/prisma";

/** Mark the board as seen: bump the session user's lastReadAt to now. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);

  await prisma.messageRead.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: { lastReadAt: new Date() },
  });

  return { ok: true };
});
