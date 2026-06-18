import { promises as fs } from "node:fs";
import { basename, resolve, sep } from "node:path";

import prisma from "~/lib/prisma";

/**
 * Serve a document's bytes by id. Any member can download. storedName is
 * server-generated, but the resolved path is still guarded (defense in depth).
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

  const name = doc.storedName;
  const dir = filesDir();
  const full = resolve(dir, name);
  if (name !== basename(name) || name.includes("..") || !full.startsWith(dir + sep)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid path" });
  }

  try {
    const data = await fs.readFile(full);
    setHeader(event, "Content-Type", doc.type || "application/octet-stream");
    // Inline so PDFs/images open in the browser; sanitize the header value.
    setHeader(event, "Content-Disposition", `inline; filename="${doc.name.replace(/["\\\r\n]/g, "_")}"`);
    setHeader(event, "Cache-Control", "private, max-age=3600");
    return data;
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }
});
