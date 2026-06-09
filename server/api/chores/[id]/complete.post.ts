import prisma from "~/lib/prisma";

/**
 * Mark a chore done for a client-local date.
 * AuthZ: the chore's assignee, or any admin (a parent can check off a kid's).
 * Points and badges are credited to the ASSIGNEE (not the session user), so
 * admin completions still reward the kid. Idempotent on double-tap. Returns
 * any newly-earned badges and whether the assignee is now all-done today, so
 * the client can fire the celebration.
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

  const assigneeId = chore.assigneeId;

  // Record the completion (idempotent).
  if (chore.recurrence === "ONCE") {
    const existing = await prisma.choreCompletion.findFirst({ where: { choreId } });
    if (!existing) {
      await prisma.choreCompletion.create({
        data: { choreId, userId: assigneeId, localDate, points: chore.points },
      });
    }
  }
  else {
    try {
      await prisma.choreCompletion.create({
        data: { choreId, userId: assigneeId, localDate, points: chore.points },
      });
    }
    catch (error: any) {
      if (error?.code !== "P2002") throw error; // P2002 = double-tap same day, fine
    }
  }

  // Award any newly-earned badges to the ASSIGNEE (read existing → diff → insert).
  const stats = await computeUserStats(assigneeId, localDate);
  const earnedBadges = await evaluateEarnedBadges(stats);
  const existingBadges = await prisma.userBadge.findMany({
    where: { userId: assigneeId },
    select: { badgeKey: true },
  });
  const have = new Set(existingBadges.map(b => b.badgeKey));
  const newBadges = earnedBadges.filter(b => !have.has(b.key));
  if (newBadges.length) {
    await prisma.userBadge.createMany({
      data: newBadges.map(b => ({ userId: assigneeId, badgeKey: b.key })),
      skipDuplicates: true,
    });
  }

  const allDoneToday = await isAllDoneToday(assigneeId, localDate);

  return {
    ok: true,
    assigneeId,
    newBadges: newBadges.map(b => ({ key: b.key, label: b.name, icon: b.icon })),
    allDoneToday,
    pointsToday: stats.pointsToday,
    streak: stats.streak,
  };
});
