import prisma from "~/lib/prisma";

/**
 * Undo a chore completion for one assignee. Query: localDate, userId?
 * (defaults to the session user; someone else's requires ADMIN).
 * For ONCE chores, removes that assignee's single completion; for
 * DAILY/WEEKLY, the one for the given client-local date. Idempotent.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const choreId = getRouterParam(event, "id");
  if (!choreId) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const query = getQuery(event);
  const localDate = String(query.localDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  const targetUserId = String(query.userId ?? "") || session.user.id;
  if (targetUserId !== session.user.id && session.user.role !== "ADMIN") {
    throw createError({ statusCode: 403, statusMessage: "You can only change your own chores" });
  }

  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore) {
    throw createError({ statusCode: 404, statusMessage: "Chore not found" });
  }

  await prisma.choreCompletion.deleteMany({
    where: chore.recurrence === "ONCE"
      ? { choreId, userId: targetUserId }
      : { choreId, userId: targetUserId, localDate },
  });
  return { ok: true };
});
