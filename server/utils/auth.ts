import type { H3Event } from "h3";

/**
 * Require an authenticated ADMIN.
 * Throws 401 if there's no session, 403 if the user isn't an admin.
 * Gate admin-only mutations (user & integration management) with this.
 */
export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event);
  if (session.user?.role !== "ADMIN") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden: admin only" });
  }
  return session;
}
