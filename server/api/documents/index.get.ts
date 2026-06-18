import prisma from "~/lib/prisma";

/** All family documents, newest first. Any member can browse. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const docs = await prisma.document.findMany({ orderBy: { createdAt: "desc" } });
  return docs.map(d => ({
    id: d.id,
    name: d.name,
    type: d.type,
    size: d.size,
    createdAt: d.createdAt,
    url: `/api/documents/${d.id}`,
  }));
});
