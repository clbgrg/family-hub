import prisma from "~/lib/prisma";

// Explicit import (not the Nitro auto-import): vitest doesn't inject server
// auto-imports, so the endpoint would throw at test runtime otherwise.
import { normalizeWeekdays } from "../../utils/weekdays";

/**
 * Edit a saved meal in the repository (already-planned meals are unaffected —
 * they're independent copies). Admin only, matching create/delete.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "saved meal id is required" });
  }

  const body = await readBody(event);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }

  try {
    return await prisma.savedMeal.update({
      where: { id },
      data: {
        title,
        notes: String(body?.notes ?? "").trim() || null,
        ingredients: String(body?.ingredients ?? "").trim() || null,
        defaultDays: normalizeWeekdays(body?.defaultDays),
      },
    });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Saved meal not found" });
    }
    throw error;
  }
});
