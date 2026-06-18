import prisma from "~/lib/prisma";

/**
 * Household settings as a key→value map. Any member can read; defaults are
 * applied client-side, so a missing key just means "use the default".
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
});
