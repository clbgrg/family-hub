import prisma from "~/lib/prisma";

/**
 * Mark a chore done for a client-local date.
 * AuthZ: the chore's assignee, or any admin (a parent can check off a kid's).
 * Points are credited to the ASSIGNEE (not the session user), so admin
 * completions still reward the kid. Idempotent on double-tap.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const choreId = getRouterParam(event, "id");
  if (!choreId) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const localDate = String((await readBody(event))?.localDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  const chore = await prisma.chore.findUnique({ where: { id: choreId } });
  if (!chore) {
    throw createError({ statusCode: 404, statusMessage: "Chore not found" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== chore.assigneeId) {
    throw createError({ statusCode: 403, statusMessage: "You can only complete your own chores" });
  }

  // ONCE chores are done forever after the first completion.
  if (chore.recurrence === "ONCE") {
    const existing = await prisma.choreCompletion.findFirst({ where: { choreId } });
    if (existing) return { ok: true, alreadyDone: true };
  }

  try {
    const completion = await prisma.choreCompletion.create({
      data: {
        choreId,
        userId: chore.assigneeId, // points go to the assignee
        localDate,
        points: chore.points,
      },
    });
    return { ok: true, completion };
  }
  catch (error: any) {
    if (error?.code === "P2002") return { ok: true, alreadyDone: true }; // double-tap, same day
    throw error;
  }
});
