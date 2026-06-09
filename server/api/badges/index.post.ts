import { randomUUID } from "node:crypto";

import { BadgeRuleType } from "@prisma/client";

import prisma from "~/lib/prisma";

function slugKey(name: string): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "BADGE";
  return `${base}_${randomUUID().slice(0, 6)}`;
}

/** Create a custom badge. Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  if (!Object.values(BadgeRuleType).includes(body?.ruleType)) {
    throw createError({ statusCode: 400, statusMessage: "ruleType must be STREAK, TOTAL_POINTS, TOTAL_COMPLETIONS, or POINTS_IN_DAY" });
  }
  const threshold = Math.max(1, Number.parseInt(String(body?.threshold), 10) || 1);

  const maxOrder = await prisma.badge.aggregate({ _max: { order: true } });

  return prisma.badge.create({
    data: {
      key: slugKey(name),
      name,
      icon: String(body?.icon ?? "").trim() || "i-lucide-award",
      description: String(body?.description ?? "").trim() || null,
      ruleType: body.ruleType,
      threshold,
      order: ((maxOrder._max?.order) || 0) + 1,
    },
  });
});
