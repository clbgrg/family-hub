import prisma from "~/lib/prisma";

/**
 * All chore areas (zones), ordered. Any member can read — used to group the
 * chore board/dashboard and to populate the chore dialog's area picker.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  return prisma.area.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
});
