import prisma from "~/lib/prisma";

/** Clear a meal cell. Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "meal id is required" });
  }

  try {
    await prisma.meal.delete({ where: { id } });
    return { ok: true };
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Meal not found" });
    }
    throw error;
  }
});
