/**
 * Upload a custom background image for a theme (admin/elevated). Multipart with
 * a `theme` field + an image `file`. Reuses fileStore (MIME allowlist + 25 MB
 * cap + generated name), deletes any prior image for that theme, and records the
 * mapping in the shared `themeBackgrounds` Setting. Returns the updated map.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const parts = await readMultipartFormData(event);
  const theme = parts?.find(p => p.name === "theme" && !p.filename)?.data?.toString().trim();
  const file = parts?.find(p => p.name === "file" && p.filename);
  if (!theme) {
    throw createError({ statusCode: 400, statusMessage: "theme is required" });
  }

  const stored = await storeUpload(file, "themebg");
  if (!stored.type.startsWith("image/")) {
    await deleteStoredFile(stored.storedName);
    throw createError({ statusCode: 400, statusMessage: "Background must be an image" });
  }

  const map = await loadThemeBgMap();
  if (map[theme]?.storedName)
    await deleteStoredFile(map[theme].storedName);
  map[theme] = { storedName: stored.storedName, name: stored.name, type: stored.type, brightness: 1, blur: 0 };
  await saveThemeBgMap(map);
  return map;
});
