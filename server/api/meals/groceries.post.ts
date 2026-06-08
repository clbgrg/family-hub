import prisma from "~/lib/prisma";

/**
 * Generate a grocery list from a week's planned-meal ingredients. Admin only.
 *
 * Writes into a DATED list ("Groceries — week of START") found-or-created by
 * exact name, and clears-then-refills it so re-running is idempotent and never
 * collides with a family's own hand-maintained "Groceries" list.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw createError({ statusCode: 400, statusMessage: "start and end (YYYY-MM-DD) are required" });
  }

  const meals = await prisma.meal.findMany({
    where: { date: { gte: start, lte: end } },
    select: { ingredients: true },
  });

  // Collect ingredient lines: trim, drop blanks, dedup case-insensitively
  // (keeping the first casing seen).
  const seen = new Set<string>();
  const items: string[] = [];
  for (const m of meals) {
    for (const raw of (m.ingredients ?? "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(line);
    }
  }

  const listName = `Groceries — week of ${start}`;
  let list = await prisma.shoppingList.findFirst({ where: { name: listName } });
  if (list) {
    await prisma.shoppingListItem.deleteMany({ where: { shoppingListId: list.id } });
  }
  else {
    const maxOrder = await prisma.shoppingList.aggregate({ _max: { order: true } });
    list = await prisma.shoppingList.create({
      data: { name: listName, order: ((maxOrder._max?.order) || 0) + 1 },
    });
  }

  if (items.length) {
    await prisma.shoppingListItem.createMany({
      data: items.map((name, i) => ({ name, shoppingListId: list!.id, order: i })),
    });
  }

  return { ok: true, listId: list.id, listName, count: items.length };
});
