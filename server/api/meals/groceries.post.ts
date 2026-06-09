import prisma from "~/lib/prisma";

// Units we recognize at the start of an ingredient line, so "1 lb chicken"
// parses into qty=1, unit=lb, name=chicken (and aggregates across days).
const UNITS = new Set([
  "lb", "lbs", "oz", "g", "kg", "gram", "grams", "cup", "cups", "tbsp", "tsp",
  "jar", "jars", "can", "cans", "bottle", "bottles", "dozen", "pack", "packs",
  "packet", "packets", "bag", "bags", "box", "boxes", "clove", "cloves",
  "bunch", "bunches", "slice", "slices", "stick", "sticks", "pint", "pints",
  "quart", "quarts", "gallon", "gallons", "ml", "l", "liter", "liters",
  "head", "heads", "loaf", "loaves",
]);

function normalizeUnit(u: string): string {
  const lower = u.toLowerCase();
  return lower.length > 1 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

interface Parsed { qty: number | null; unit: string; name: string }

// "2 lbs chicken" -> {2, lbs, chicken}; "parmesan" -> {null, "", parmesan};
// "1/2 cup rice" / "1.5 lb beef" -> qty null (kept as free text, not summed).
function parseLine(line: string): Parsed {
  const m = /^(\d+)\s+(.+)$/.exec(line);
  if (!m) {
    return { qty: null, unit: "", name: line };
  }
  const [, qtyStr = "", restRaw = ""] = m;
  const qty = Number.parseInt(qtyStr, 10);
  const rest = restRaw.trim();

  const wm = /^(\S+)\s+(.+)$/.exec(rest);
  if (wm) {
    const [, unit = "", name = ""] = wm;
    if (UNITS.has(unit.toLowerCase())) {
      return { qty, unit, name: name.trim() };
    }
  }
  return { qty, unit: "", name: rest };
}

/**
 * Generate a grocery list from a week's planned-meal ingredients. Admin only.
 *
 * Quantities for the same item+unit are SUMMED across days ("1 lb chicken" on
 * Mon + Tue -> "2 lb chicken"); unmeasured items (no leading number) are just
 * de-duplicated. Stored via the shopping item's structured quantity/unit so the
 * list renders "2 lb chicken" natively.
 *
 * Writes into a DATED list ("Groceries — week of START"), found-or-created by
 * exact name and cleared-then-refilled so re-running is idempotent.
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

  const measured = new Map<string, { qty: number; unit: string; name: string }>();
  const unmeasured = new Map<string, string>(); // lowercased line -> first-seen text

  for (const meal of meals) {
    for (const raw of (meal.ingredients ?? "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const p = parseLine(line);
      if (p.qty == null) {
        const key = line.toLowerCase();
        if (!unmeasured.has(key)) unmeasured.set(key, line);
      }
      else {
        const key = `${normalizeUnit(p.unit)}|${p.name.toLowerCase()}`;
        const existing = measured.get(key);
        if (existing) existing.qty += p.qty;
        else measured.set(key, { qty: p.qty, unit: p.unit, name: p.name });
      }
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

  let order = 0;
  const data = [
    ...[...measured.values()].map(v => ({ name: v.name, quantity: v.qty, unit: v.unit || null, shoppingListId: list!.id, order: order++ })),
    ...[...unmeasured.values()].map(name => ({ name, quantity: 1, unit: null as string | null, shoppingListId: list!.id, order: order++ })),
  ];

  if (data.length) {
    await prisma.shoppingListItem.createMany({ data });
  }

  return { ok: true, listId: list.id, listName, count: data.length };
});
