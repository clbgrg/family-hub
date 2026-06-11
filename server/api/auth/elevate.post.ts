import prisma from "~/lib/prisma";

export const ELEVATION_TTL_MS = 5 * 60_000;

// Cheap brute-force damper (bcrypt is the real rate limiter): after 5 straight
// failures from an IP, add a 2s delay to each further attempt. In-memory —
// resets on restart, which is fine for a LAN family app.
const failures = new Map<string, number>();

/**
 * "Parent unlock": re-enter a PIN on an already-signed-in ADMIN session to
 * allow management mutations for ELEVATION_TTL_MS (see requireElevatedAdmin).
 * Any admin's PIN unlocks — the kiosk session may be one parent while the
 * other is standing at the screen.
 * Uniform 401 on failure — don't leak which admin or whether a PIN exists.
 */
export default defineEventHandler(async (event) => {
  // /api/auth/* bypasses the global auth middleware — guard explicitly.
  const session = await requireUserSession(event);
  if (session.user?.role !== "ADMIN") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden: admin only" });
  }

  const body = await readBody(event);
  const pin = String(body?.pin ?? "");
  if (!/^\d{4,8}$/.test(pin)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid PIN" });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if ((failures.get(ip) ?? 0) >= 5) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", pinHash: { not: null } },
    omit: { pinHash: false },
  });
  let matched = false;
  for (const admin of admins) {
    if (admin.pinHash && (await verifyPassword(admin.pinHash, pin))) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    failures.set(ip, (failures.get(ip) ?? 0) + 1);
    throw createError({ statusCode: 401, statusMessage: "Invalid PIN" });
  }
  failures.delete(ip);

  const elevatedUntil = Date.now() + ELEVATION_TTL_MS;
  // setUserSession merges (defu) over the existing session, preserving `user`.
  await setUserSession(event, { elevatedUntil });
  return { elevatedUntil };
});
