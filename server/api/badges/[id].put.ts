import { BadgeRuleType } from "@prisma/client";

import prisma from "~/lib/prisma";

/** Update a badge. Admin only. The key (which earned records point at) is stable. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "badge id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.icon === "string") data.icon = body.icon.trim() || "i-lucide-award";
  if ("description" in body) data.description = String(body.description ?? "").trim() || null;
  if (Object.values(BadgeRuleType).includes(body?.ruleType)) data.ruleType = body.ruleType;
  if (body?.threshold !== undefined) data.threshold = Math.max(1, Number.parseInt(String(body.threshold), 10) || 1);

  try {
    return await prisma.badge.update({ where: { id }, data });
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Badge not found" });
    }
    throw error;
  }
});
