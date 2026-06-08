import prisma from "~/lib/prisma";

/**
 * Admin sets or resets a user's login PIN — used to onboard family members
 * (e.g. give a kid a PIN) and to reset a forgotten one. Admin-only.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
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
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }
    throw error;
  }

  return { ok: true };
});
