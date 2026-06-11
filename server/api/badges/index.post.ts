import { randomUUID } from "node:crypto";

import prisma from "~/lib/prisma";

function slugKey(name: string): string {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "BADGE";
  return `${base}_${randomUUID().slice(0, 6)}`;
}

/** Create a custom badge. Parent unlock required. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  const conditions = validateBadgeConditions(body?.conditions);
  const appliesToUserIds = await validateBadgeAppliesTo(body?.appliesToUserIds);

  const maxOrder = await prisma.badge.aggregate({ _max: { order: true } });

  return prisma.badge.create({
    data: {
      key: slugKey(name),
      name,
      icon: String(body?.icon ?? "").trim() || "i-lucide-award",
      description: String(body?.description ?? "").trim() || null,
      conditions,
      appliesToUserIds,
      order: ((maxOrder._max?.order) || 0) + 1,
    },
  });
});
