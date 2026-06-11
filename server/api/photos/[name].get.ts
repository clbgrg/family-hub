import { promises as fs } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Serve one screensaver photo. The filename is attacker-controllable, so this
 * is the security-critical bit: accept a bare basename only (no separators,
 * no `..`, no dotfiles), require a known image extension, and confirm the
 * resolved path stays inside the photos directory before reading.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

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

  const ext = extname(name).toLowerCase();
  if (!CONTENT_TYPE[ext]) {
    throw createError({ statusCode: 400, statusMessage: "Not an image" });
  }

  const dir = photosDir();
  const full = resolve(dir, name);
  if (!full.startsWith(dir + sep)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid path" });
  }

  try {
    const data = await fs.readFile(full);
    setHeader(event, "Content-Type", CONTENT_TYPE[ext]);
    setHeader(event, "Cache-Control", "public, max-age=3600");
    return data;
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: "Photo not found" });
  }
});
