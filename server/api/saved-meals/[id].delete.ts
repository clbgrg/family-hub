import prisma from "~/lib/prisma";

/** Remove a meal from the repository (planned meals are unaffected). Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "saved meal id is required" });
  }

  await prisma.savedMeal.deleteMany({ where: { id } });
  return { ok: true };
});
