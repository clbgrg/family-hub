import { promises as fs } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function photosDir(): string {
  return process.env.PHOTOS_DIR || resolve(process.cwd(), "photos");
}

/** Delete a screensaver photo. Admin only. Same strict filename guard as serve. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const name = decodeURIComponent(getRouterParam(event, "name") || "");
  if (
    !name
    || name !== basename(name)
    || name.includes("/")
    || name.includes("\\")
    || name.includes("..")
    || name.startsWith(".")
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid filename" });
  }
  if (!IMAGE_EXT.has(extname(name).toLowerCase())) {
    throw createError({ statusCode: 400, statusMessage: "Not an image" });
  }

  const dir = photosDir();
  const full = resolve(dir, name);
  if (!full.startsWith(dir + sep)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid path" });
  }

  try {
    await fs.unlink(full);
    return { ok: true };
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: "Photo not found" });
  }
});
