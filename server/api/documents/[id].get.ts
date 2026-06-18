import prisma from "~/lib/prisma";

/**
 * Serve a document's bytes by id. Any member can download. The path is guarded
 * inside serveStoredFile (defense in depth — storedName is server-generated).
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: "Document not found" });
  }

  return serveStoredFile(event, doc.storedName, doc.name, doc.type);
});
