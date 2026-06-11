import prisma from "~/lib/prisma";

/**
 * Set or reset a user's login PIN. An admin can set anyone's (onboard a kid,
 * reset a forgotten PIN); a member can set only their OWN. Same 4-8 digit
 * format as setup/login, so a self-changed PIN can log in afterward.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== id) {
    throw createError({ statusCode: 403, statusMessage: "You can only change your own PIN" });
  }
  // Changing your own PIN stays ungated; resetting someone ELSE's is a
  // management action and needs a fresh parent unlock (shared kiosk session).
  if (session.user.id !== id) {
    await requireElevatedAdmin(event);
  }

  const body = await readBody(event);
  const pin = String(body?.pin ?? "");
  if (!/^\d{4,8}$/.test(pin)) {
    throw createError({ statusCode: 400, statusMessage: "PIN must be 4-8 digits" });
  }

  const pinHash = await hashPassword(pin);
  try {
    await prisma.user.update({ where: { id }, data: { pinHash } });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }
    throw error;
  }

  return { ok: true };
});
