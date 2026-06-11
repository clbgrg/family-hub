import prisma from "~/lib/prisma";

/**
 * Apply a manual points adjustment (parent unlock required): negative delta
 * = deduction ("fighting"), positive = bonus. Affects points/balance only —
 * never streaks, completion counts, or badges.
 */
export default defineEventHandler(async (event) => {
  const session = await requireElevatedAdmin(event);

  const body = await readBody(event);
  const userId = String(body?.userId ?? "");
  const delta = Number.parseInt(String(body?.delta), 10);
  const reason = String(body?.reason ?? "").trim();
  const localDate = String(body?.localDate ?? "");

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw createError({ statusCode: 400, statusMessage: "delta must be a non-zero integer" });
  }
  if (!reason) {
    throw createError({ statusCode: 400, statusMessage: "reason is required" });
  }
  if (reason.length > 200) {
    throw createError({ statusCode: 400, statusMessage: "reason must be 200 characters or fewer" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw createError({ statusCode: 400, statusMessage: "localDate (YYYY-MM-DD) is required" });
  }

  try {
    return await prisma.pointAdjustment.create({
      data: { userId, delta, reason, localDate, createdById: session.user.id },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "member does not exist" });
    }
    throw error;
  }
});
