// Serve a custom theme-background image by its stored name (any signed-in
// member). The bytes are served inline from the files volume via fileStore.
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export default defineEventHandler(async (event) => {
  await requireUserSession(event);
  const name = getRouterParam(event, "name") ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return serveStoredFile(event, name, name, EXT_MIME[ext] ?? "application/octet-stream");
});
