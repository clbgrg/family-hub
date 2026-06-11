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

/**
 * Require an ADMIN session that recently re-entered a PIN (POST /api/auth/elevate).
 * The kiosk stays signed in as an admin, so role alone can't tell a parent from
 * a kid at the shared screen — management mutations need this fresh-PIN check.
 * The literal "ELEVATION_REQUIRED" statusMessage is the contract the client
 * uses to know it should prompt for a PIN and retry.
 */
export async function requireElevatedAdmin(event: H3Event) {
  const session = await requireAdmin(event);
  if (!session.elevatedUntil || session.elevatedUntil < Date.now()) {
    throw createError({ statusCode: 403, statusMessage: "ELEVATION_REQUIRED" });
  }
  return session;
}
