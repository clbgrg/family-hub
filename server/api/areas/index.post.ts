import prisma from "~/lib/prisma";

/** Create a chore area. Admin only (parents manage areas). */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }

  const maxOrder = await prisma.area.aggregate({ _max: { order: true } });

  return prisma.area.create({
    data: {
      name,
      icon: String(body?.icon ?? "").trim() || null,
      order: ((maxOrder._max?.order) || 0) + 1,
    },
  });
});
