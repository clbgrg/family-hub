import prisma from "~/lib/prisma";

/**
 * Serve a message's attachment bytes by message id. Any member can download.
 * The path is guarded inside serveStoredFile (storedName is server-generated).
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg?.attachmentStoredName) {
    throw createError({ statusCode: 404, statusMessage: "Attachment not found" });
  }

  return serveStoredFile(
    event,
    msg.attachmentStoredName,
    msg.attachmentName ?? "attachment",
    msg.attachmentType ?? "application/octet-stream",
  );
});
