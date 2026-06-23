/**
 * Remove a theme's custom background (admin/elevated). The `[name]` param here
 * is the THEME name. Deletes the stored file and drops the mapping entry, so the
 * theme reverts to its bundled art. Returns the updated map.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);
  const theme = getRouterParam(event, "name") ?? "";
  const map = await loadThemeBgMap();
  if (map[theme]?.storedName)
    await deleteStoredFile(map[theme].storedName);
  delete map[theme];
  await saveThemeBgMap(map);
  return map;
});
