import { promises as fs } from "node:fs";
import { extname, resolve } from "node:path";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function photosDir(): string {
  return process.env.PHOTOS_DIR || resolve(process.cwd(), "photos");
}

/** List screensaver photos. Returns image filenames + their serve URLs. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(photosDir());
  }
  catch {
    return []; // no photos dir yet → empty
  }

  return entries
    .filter(name => !name.startsWith(".") && IMAGE_EXT.has(extname(name).toLowerCase()))
    .sort()
    .map(name => ({ name, url: `/api/photos/${encodeURIComponent(name)}` }));
});
