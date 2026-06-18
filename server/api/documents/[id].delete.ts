import { promises as fs } from "node:fs";
import { basename, resolve, sep } from "node:path";

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

  const name = doc.storedName;
  const dir = filesDir();
  const full = resolve(dir, name);
  if (name === basename(name) && !name.includes("..") && full.startsWith(dir + sep)) {
    await fs.unlink(full).catch(() => {}); // tolerate an already-missing file
  }
  await prisma.document.delete({ where: { id } });
  return { ok: true };
});
