import { MealSlot } from "@prisma/client";

import prisma from "~/lib/prisma";

/**
 * Set the meal for a (date, slot) cell — upsert, since each cell holds one meal.
 * Admin only (parents plan the week). Meals are family-wide; cook is optional.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const date = String(body?.date ?? "");
  const slot = String(body?.slot ?? "");
  const title = String(body?.title ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) is required" });
  }
  if (!Object.values(MealSlot).includes(slot as MealSlot)) {
    throw createError({ statusCode: 400, statusMessage: "slot must be BREAKFAST, LUNCH, or DINNER" });
  }
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }
  const slotEnum = slot as MealSlot;

  const data = {
    title,
    notes: String(body?.notes ?? "").trim() || null,
    ingredients: String(body?.ingredients ?? "").trim() || null,
    time: String(body?.time ?? "").trim() || null,
    cookId: body?.cookId ? String(body.cookId) : null,
  };

  try {
    return await prisma.meal.upsert({
      where: { date_slot: { date, slot: slotEnum } },
      create: { date, slot: slotEnum, ...data },
      update: data,
    });
  }
  catch (error: any) {
    if (error?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "cook does not exist" });
    }
    throw error;
  }
});
