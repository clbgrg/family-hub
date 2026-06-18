import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

import prisma from "~/lib/prisma";

// MIME → extension allowlist (documents + media). The type is validated by the
// upload's content-type; the stored name is fully generated (no traversal).
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Upload a family document. Admin only. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const parts = await readMultipartFormData(event);
  const file = parts?.find(p => p.name === "file" && p.filename);
  if (!file || !file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const ext = EXT_BY_TYPE[file.type ?? ""];
  if (!ext) {
    throw createError({ statusCode: 400, statusMessage: "Unsupported file type" });
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "File too large (max 25 MB)" });
  }

  const storedName = `doc-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = filesDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolve(dir, storedName), file.data);

  return prisma.document.create({
    data: {
      name: (file.filename || storedName).slice(0, 200),
      storedName,
      type: file.type || "application/octet-stream",
      size: file.data.length,
    },
  });
});
