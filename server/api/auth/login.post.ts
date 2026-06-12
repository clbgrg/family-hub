import prisma from "~/lib/prisma";

/**
 * Log in by selecting a user (userId) and entering their PIN.
 * Kid tap-in: a MEMBER with no PIN set signs in by just picking their profile
 * (the parent controls this by setting — or not setting — a PIN for them).
 * Everyone else (any ADMIN, any member with a PIN) must enter their PIN, with
 * a uniform 401 whether the user is missing, has no PIN, or the PIN is wrong.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = String(body?.userId ?? "");
  const pin = String(body?.pin ?? "");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Opt back in to pinHash (globally omitted) — verification needs it.
    omit: { pinHash: false },
  });
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Invalid PIN" });
  }
  const tapIn = user.role === "MEMBER" && !user.pinHash;
  if (!tapIn && (!user.pinHash || !(await verifyPassword(user.pinHash, pin)))) {
    throw createError({ statusCode: 401, statusMessage: "Invalid PIN" });
  }

  await setUserSession(event, {
    user: { id: user.id, name: user.name, role: user.role },
  });

  return { id: user.id, name: user.name, role: user.role };
});
