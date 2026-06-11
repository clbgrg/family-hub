import prisma from "~/lib/prisma";

/**
 * Check off a school item. AuthZ: the item's assignee or any admin (parent
 * checks off a kid's; the kid is credited). Points flow into the SAME pool
 * as chores (balance, streak, badges). Idempotent. "All done" celebration
 * stays a chores concept — school returns badge toasts only.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const itemId = getRouterParam(event, "id");
  if (!itemId) {
    throw createError({ statusCode: 400, statusMessage: "school item id is required" });
  }

  const localDate = String((await readBody(event))?.localDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  const item = await prisma.schoolItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: "School item not found" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== item.userId) {
    throw createError({ statusCode: 403, statusMessage: "You can only complete your own school items" });
  }

  try {
    await prisma.schoolItemCompletion.create({
      data: { schoolItemId: itemId, userId: item.userId, localDate, points: item.points },
    });
  }
  catch (error) {
    // P2002 = already completed (double-tap), fine
    if ((error as { code?: string })?.code !== "P2002")
      throw error;
  }

  const { newBadges, stats } = await awardNewBadges(item.userId, localDate);

  return {
    ok: true,
    userId: item.userId,
    newBadges,
    pointsToday: stats.pointsToday,
    streak: stats.streak,
  };
});
