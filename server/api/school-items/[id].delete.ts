import prisma from "~/lib/prisma";

/** Delete a school item (cascades its completion). Parent unlock required. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "school item id is required" });
  }

  try {
    await prisma.schoolItem.delete({ where: { id } });
    return { ok: true };
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "School item not found" });
    }
    throw error;
  }
});
