import prisma from "~/lib/prisma";

/** Remove an adjustment (undo a fat-finger). Parent unlock required. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "adjustment id is required" });
  }

  try {
    await prisma.pointAdjustment.delete({ where: { id } });
    return { ok: true };
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Adjustment not found" });
    }
    throw error;
  }
});
