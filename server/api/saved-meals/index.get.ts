import prisma from "~/lib/prisma";

/** The saved-meals repository, alphabetical. Any member can read. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  return prisma.savedMeal.findMany({ orderBy: { title: "asc" } });
});
