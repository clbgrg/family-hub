import prisma from "~/lib/prisma";

/** Delete a document — its DB row and the file on disk. Admin only. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: "Document not found" });
  }

  await deleteStoredFile(doc.storedName);
  await prisma.document.delete({ where: { id } });
  return { ok: true };
});
