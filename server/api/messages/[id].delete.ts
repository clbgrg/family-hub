import prisma from "~/lib/prisma";

/** Delete a note. The author can delete their own; an admin can delete any. */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "message id is required" });
  }

  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) {
    throw createError({ statusCode: 404, statusMessage: "Message not found" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== message.authorId) {
    throw createError({ statusCode: 403, statusMessage: "You can only delete your own messages" });
  }

  await prisma.message.delete({ where: { id } });
  return { ok: true };
});
