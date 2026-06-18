import prisma from "~/lib/prisma";

/** Upload a family document. Admin only. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const parts = await readMultipartFormData(event);
  const file = parts?.find(p => p.name === "file" && p.filename);
  const stored = await storeUpload(file, "doc");

  return prisma.document.create({
    data: {
      name: stored.name,
      storedName: stored.storedName,
      type: stored.type,
      size: stored.size,
    },
  });
});
