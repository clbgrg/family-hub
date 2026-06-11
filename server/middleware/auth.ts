/**
 * Global API auth guard. Any /api/** route requires a valid session, except:
 *   - non-/api routes (pages & assets are guarded client-side)
 *   - /api/_*  Nuxt-internal routes (e.g. @nuxt/ui icon endpoint, and
 *     nuxt-auth-utils' /api/_auth/session which the client must read even
 *     when logged out to learn it is logged out)
 *   - /api/auth/* our own setup/login/logout (must work while logged out)
 */
export default defineEventHandler(async (event) => {
  const path = event.path;

  if (!path.startsWith("/api/"))
    return;
  if (path.startsWith("/api/_"))
    return;
  if (path.startsWith("/api/auth/"))
    return;

  await requireUserSession(event);
});
