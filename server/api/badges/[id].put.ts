import prisma from "~/lib/prisma";

/** Update a badge. Parent unlock required. The key (which earned records point at) is stable. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "badge id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string")
    data.name = body.name.trim();
  if (typeof body?.icon === "string")
    data.icon = body.icon.trim() || "i-lucide-award";
  if ("description" in body)
    data.description = String(body.description ?? "").trim() || null;
  if (body?.conditions !== undefined)
    data.conditions = validateBadgeConditions(body.conditions);
  if (body?.appliesToUserIds !== undefined)
    data.appliesToUserIds = await validateBadgeAppliesTo(body.appliesToUserIds);

  try {
    return await prisma.badge.update({ where: { id }, data });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Badge not found" });
    }
    throw error;
  }
});
