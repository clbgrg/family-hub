import prisma from "~/lib/prisma";

/** Redemption requests. A member sees their own; an admin sees all (the queue). */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const where = session.user.role === "ADMIN" ? {} : { userId: session.user.id };

  return prisma.redemption.findMany({
    where,
    include: { user: { select: { id: true, name: true, avatar: true, color: true } } },
    orderBy: { requestedAt: "desc" },
  });
});
