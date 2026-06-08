import prisma from "~/lib/prisma";

/** Delete a chore (cascades its completions). Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  try {
    await prisma.chore.delete({ where: { id } });
    return { ok: true };
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Chore not found" });
    }
    throw error;
  }
});
