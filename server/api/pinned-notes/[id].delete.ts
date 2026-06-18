import prisma from "~/lib/prisma";

/**
 * Remove a note from the Family Bulletin. Any authenticated member can delete
 * any note (family-trust, matching the message board). Idempotent if it's gone.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "note id is required" });
  }

  await prisma.pinnedNote.deleteMany({ where: { id } });
  return { ok: true };
});
