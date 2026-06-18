import prisma from "~/lib/prisma";

// Only these keys are writable — guards against arbitrary settings being set.
const ALLOWED = new Set(["pointsLabel", "gradeScale", "pinnedNoteTitle", "pinnedNoteBody"]);

/**
 * Upsert one or more household settings. Admin only. Body is a key→value
 * object; unknown keys are ignored. Returns the full settings map.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const body = await readBody(event);
  if (!body || typeof body !== "object") {
    throw createError({ statusCode: 400, statusMessage: "object body of key:value required" });
  }

  const updates = Object.entries(body).filter(([k]) => ALLOWED.has(k));
  await Promise.all(updates.map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value ?? "") },
      update: { value: String(value ?? "") },
    }),
  ));

  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
});
