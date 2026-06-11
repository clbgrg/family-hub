import prisma from "~/lib/prisma";

/**
 * Mark a chore done for a client-local date, for one assignee.
 * Body: { localDate, userId? } — userId defaults to the session user; passing
 * someone else's id requires ADMIN (a parent checks off a kid's copy; the kid
 * is still the one credited). The target must be one of the chore's assignees.
 * Points and badges go to the TARGET assignee. Idempotent on double-tap.
 * Returns newly-earned badges and whether the assignee is now all-done today,
 * so the client can fire the celebration.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const choreId = getRouterParam(event, "id");
  if (!choreId) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const body = await readBody(event);
  const localDate = String(body?.localDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  const targetUserId = String(body?.userId ?? "") || session.user.id;
  if (targetUserId !== session.user.id && session.user.role !== "ADMIN") {
    throw createError({ statusCode: 403, statusMessage: "You can only complete your own chores" });
  }

  const chore = await prisma.chore.findUnique({
    where: { id: choreId },
    include: { assignments: { select: { userId: true } } },
  });
  if (!chore) {
    throw createError({ statusCode: 404, statusMessage: "Chore not found" });
  }
  if (!chore.assignments.some(a => a.userId === targetUserId)) {
    throw createError({ statusCode: 400, statusMessage: "That chore isn't assigned to that member" });
  }

  // Record the completion (idempotent per assignee).
  if (chore.recurrence === "ONCE") {
    const existing = await prisma.choreCompletion.findFirst({
      where: { choreId, userId: targetUserId },
    });
    if (!existing) {
      await prisma.choreCompletion.create({
        data: { choreId, userId: targetUserId, localDate, points: chore.points },
      });
    }
  }
  else {
    try {
      await prisma.choreCompletion.create({
        data: { choreId, userId: targetUserId, localDate, points: chore.points },
      });
    }
    catch (error) {
      // P2002 = double-tap same day, fine
      if ((error as { code?: string })?.code !== "P2002")
        throw error;
    }
  }

  const { newBadges, stats } = await awardNewBadges(targetUserId, localDate);
  const allDoneToday = await isAllDoneToday(targetUserId, localDate);

  return {
    ok: true,
    assigneeId: targetUserId,
    newBadges,
    allDoneToday,
    pointsToday: stats.pointsToday,
    streak: stats.streak,
  };
});
