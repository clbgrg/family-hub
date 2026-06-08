import prisma from "~/lib/prisma";

/**
 * Undo a chore completion. AuthZ: assignee or admin.
 * For ONCE chores, removes the single completion; for DAILY/WEEKLY, removes
 * the one for the given client-local date. Idempotent.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const choreId = getRouterParam(event, "id");
  if (!choreId) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const localDate = String(getQuery(event).localDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore) {
    throw createError({ statusCode: 404, statusMessage: "Chore not found" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== chore.assigneeId) {
    throw createError({ statusCode: 403, statusMessage: "You can only change your own chores" });
  }

  await prisma.choreCompletion.deleteMany({
    where: chore.recurrence === "ONCE" ? { choreId } : { choreId, localDate },
  });
  return { ok: true };
});
