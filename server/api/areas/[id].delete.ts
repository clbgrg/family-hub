import prisma from "~/lib/prisma";

/**
 * Delete a chore area. Admin only. Chores in this area are kept — the FK sets
 * their areaId to null (they fall back to the "Other" group on the board).
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "area id is required" });
  }

  try {
    await prisma.area.delete({ where: { id } });
    return { ok: true };
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Area not found" });
    }
    throw error;
  }
});
