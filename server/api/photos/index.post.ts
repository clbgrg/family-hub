import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function photosDir(): string {
  return process.env.PHOTOS_DIR || resolve(process.cwd(), "photos");
}

/**
 * Upload a screensaver photo. Admin only. The stored filename is fully
 * generated (never the uploaded name → no traversal/collision), the type is
 * allowlisted by content-type, and the size is capped.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const parts = await readMultipartFormData(event);
  const file = parts?.find(p => p.name === "file" && p.filename);
  if (!file || !file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const ext = EXT_BY_TYPE[file.type ?? ""];
  if (!ext) {
    throw createError({ statusCode: 400, statusMessage: "Only JPG, PNG, GIF, or WEBP images" });
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "Image too large (max 10 MB)" });
  }

  const name = `photo-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dir = photosDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolve(dir, name), file.data);

  return { ok: true, name, url: `/api/photos/${name}` };
});
