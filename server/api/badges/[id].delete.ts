import prisma from "~/lib/prisma";

/**
 * Delete a badge definition. Admin only. Already-earned UserBadge rows are kept
 * (they reference the key, not a FK), so a member's history survives — the
 * display just degrades to a default icon if the definition is gone.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "badge id is required" });
  }

  try {
    await prisma.badge.delete({ where: { id } });
    return { ok: true };
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Badge not found" });
    }
    throw error;
  }
});
