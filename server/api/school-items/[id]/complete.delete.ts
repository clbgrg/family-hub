import prisma from "~/lib/prisma";

/** Undo a school item check-off. AuthZ: assignee or admin. Idempotent. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const itemId = getRouterParam(event, "id");
  if (!itemId) {
    throw createError({ statusCode: 400, statusMessage: "school item id is required" });
  }

  const item = await prisma.schoolItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: "School item not found" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== item.userId) {
    throw createError({ statusCode: 403, statusMessage: "You can only change your own school items" });
  }

  await prisma.schoolItemCompletion.deleteMany({ where: { schoolItemId: itemId } });
  return { ok: true };
});
