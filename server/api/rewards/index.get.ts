import prisma from "~/lib/prisma";

/** Active rewards catalog. Any member can browse the store. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  return prisma.reward.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
});
