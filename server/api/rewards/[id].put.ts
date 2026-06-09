import prisma from "~/lib/prisma";

/** Update a reward. Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "reward id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (body?.pointsCost !== undefined) data.pointsCost = Math.max(0, Number.parseInt(String(body.pointsCost), 10) || 0);
  if ("imageUrl" in body) data.imageUrl = String(body.imageUrl ?? "").trim() || null;
  if (typeof body?.active === "boolean") data.active = body.active;

  try {
    return await prisma.reward.update({ where: { id }, data });
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Reward not found" });
    }
    throw error;
  }
});
