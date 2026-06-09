import prisma from "~/lib/prisma";

/**
 * Remove a note from the shared family board. Any logged-in member can delete
 * any note — family-trust, matching the "post as anyone" From picker (and notes
 * auto-expire in a week anyway). Idempotent if it's already gone.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "message id is required" });
  }

  await prisma.message.deleteMany({ where: { id } });
  return { ok: true };
});
