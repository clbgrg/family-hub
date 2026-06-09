import prisma from "~/lib/prisma";

/** Create a reward. Admin only (parents curate the store). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  const pointsCost = Math.max(0, Number.parseInt(String(body?.pointsCost), 10) || 0);

  const maxOrder = await prisma.reward.aggregate({ _max: { order: true } });

  return prisma.reward.create({
    data: {
      name,
      pointsCost,
      imageUrl: String(body?.imageUrl ?? "").trim() || null,
      order: ((maxOrder._max?.order) || 0) + 1,
    },
  });
});
