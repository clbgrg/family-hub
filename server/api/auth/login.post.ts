import prisma from "~/lib/prisma";

/**
 * Log in by selecting a user (userId) and entering their PIN.
 * Returns a uniform 401 whether the user is missing, has no PIN, or the PIN is
 * wrong — don't leak which.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = String(body?.userId ?? "");
  const pin = String(body?.pin ?? "");
  if (!userId || !pin) {
    throw createError({ statusCode: 400, statusMessage: "userId and pin are required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Opt back in to pinHash (globally omitted) — verification needs it.
    omit: { pinHash: false },
  });
  if (!user?.pinHash || !(await verifyPassword(user.pinHash, pin))) {
    throw createError({ statusCode: 401, statusMessage: "Invalid PIN" });
  }

  await setUserSession(event, {
    user: { id: user.id, name: user.name, role: user.role },
  });

  return { id: user.id, name: user.name, role: user.role };
});
