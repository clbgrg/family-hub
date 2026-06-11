import prisma from "~/lib/prisma";

/**
 * Reject (decline) a redemption. Admin only. Releases the advisory hold. Only
 * acts on a PENDING request.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "redemption id is required" });
  }

  const redemption = await prisma.redemption.findUnique({ where: { id } });
  if (!redemption) {
    throw createError({ statusCode: 404, statusMessage: "Redemption not found" });
  }
  if (redemption.status !== "PENDING") {
    throw createError({ statusCode: 409, statusMessage: "This request was already decided" });
  }

  return prisma.redemption.update({
    where: { id },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
});
