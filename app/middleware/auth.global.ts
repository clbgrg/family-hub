/**
 * Client-side route guard, mirror of server/middleware/auth.ts.
 *   - /login and /setup are always reachable (and bounce authed users home).
 *   - First run (no admin yet) → /setup.
 *   - Otherwise, not-logged-in → /login.
 * Only hits /api/auth/setup when actually logged out, to avoid a fetch per nav.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const isPublic = to.path === "/login" || to.path === "/setup";
  const { loggedIn } = useUserSession();

  if (loggedIn.value) {
    // Authenticated: keep them off the login/setup screens.
    if (isPublic) return navigateTo("/");
    return;
  }

  if (isPublic) return;

  const { needsSetup } = await $fetch<{ needsSetup: boolean }>("/api/auth/setup");
  return navigateTo(needsSetup ? "/setup" : "/login");
});
