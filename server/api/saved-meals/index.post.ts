import prisma from "~/lib/prisma";

// Explicit import (not the Nitro auto-import): vitest doesn't inject server
// auto-imports, so the endpoint would throw at test runtime otherwise.
import { normalizeWeekdays } from "../../utils/weekdays";

/**
 * Save a meal to the repository. Admin only (parents plan meals, matching the
 * planner's PUT). Duplicate titles are allowed — the family may well have two
 * "Tacos" with different ingredients; pruning is one tap.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }

  return prisma.savedMeal.create({
    data: {
      title,
      notes: String(body?.notes ?? "").trim() || null,
      ingredients: String(body?.ingredients ?? "").trim() || null,
      defaultDays: normalizeWeekdays(body?.defaultDays),
    },
  });
});
