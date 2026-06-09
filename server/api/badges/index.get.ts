/** Badge definitions (seeds defaults on first use). Any member can view. */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);
  return getBadges();
});
