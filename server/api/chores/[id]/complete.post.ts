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
    include: {
      assignments: { select: { userId: true } },
      reward: { select: { id: true, name: true } },
    },
  });
  if (!chore) {
    throw createError({ statusCode: 404, statusMessage: "Chore not found" });
  }
  if (!chore.assignments.some(a => a.userId === targetUserId)) {
    throw createError({ statusCode: 400, statusMessage: "That chore isn't assigned to that member" });
  }

  // Up-for-grabs: first claim wins. Reject if someone else already took it
  // (per day for recurring; ever for ONCE); the same user re-tapping is fine.
  if (chore.claimable) {
    const existingClaim = await prisma.choreCompletion.findFirst({
      where: chore.recurrence === "ONCE" ? { choreId } : { choreId, localDate },
      select: { userId: true },
    });
    if (existingClaim && existingClaim.userId !== targetUserId) {
      throw createError({ statusCode: 409, statusMessage: "Already claimed by someone else" });
    }
  }

  // Auto point-boost: a neglected recurring chore is worth more. Derive the
  // bonus from the last completion strictly before today and freeze base+bonus
  // into the completion row, so the credited points never drift afterwards and
  // the next occurrence (now that it's been done) resets to base.
  let awardPoints = chore.points;
  if (chore.recurrence !== "ONCE" && await getBoolSetting("autoBoostEnabled")) {
    const last = await prisma.choreCompletion.findFirst({
      where: { choreId, localDate: { lt: localDate } },
      orderBy: { localDate: "desc" },
      select: { localDate: true },
    });
    awardPoints += computeBoost(
      { recurrence: chore.recurrence, daysOfWeek: chore.daysOfWeek, startDate: chore.startDate, endDate: chore.endDate, pausedUntil: chore.pausedUntil, createdAt: chore.createdAt.toISOString().slice(0, 10) },
      last?.localDate ?? null,
      localDate,
    );
  }

  // Record the completion (idempotent per assignee). Track whether it's new so
  // a fixed reward is granted exactly once per occurrence.
  let createdNew = false;
  if (chore.recurrence === "ONCE") {
    const existing = await prisma.choreCompletion.findFirst({
      where: { choreId, userId: targetUserId },
    });
    if (!existing) {
      await prisma.choreCompletion.create({
        data: { choreId, userId: targetUserId, completedById: session.user.id, localDate, points: awardPoints },
      });
      createdNew = true;
    }
  }
  else {
    try {
      await prisma.choreCompletion.create({
        data: { choreId, userId: targetUserId, completedById: session.user.id, localDate, points: awardPoints },
      });
      createdNew = true;
    }
    catch (error) {
      // P2002 = double-tap same day, fine
      if ((error as { code?: string })?.code !== "P2002")
        throw error;
    }
  }

  // Fixed reward: queue it as a pending redemption for a parent to approve.
  // pointsCost 0 — it's earned by doing the chore, not bought with points.
  if (createdNew && chore.reward) {
    await prisma.redemption.create({
      data: {
        rewardId: chore.reward.id,
        userId: targetUserId,
        rewardName: chore.reward.name,
        pointsCost: 0,
        status: "PENDING",
      },
    });
  }

  const [{ newBadges, stats }, allDoneToday] = await Promise.all([
    awardNewBadges(targetUserId, localDate),
    isAllDoneToday(targetUserId, localDate),
  ]);

  return {
    ok: true,
    assigneeId: targetUserId,
    newBadges,
    allDoneToday,
    pointsToday: stats.pointsToday,
    streak: stats.streak,
  };
});
