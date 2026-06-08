import prisma from "~/lib/prisma";

/**
 * Create the first admin account (first-run only). Self-locking: once any admin
 * exists this returns 403, so it can't be used to mint extra admins later.
 * Logs the new admin in on success.
 */
export default defineEventHandler(async (event) => {
  const adminExists = (await prisma.user.count({ where: { role: "ADMIN" } })) > 0;
  if (adminExists) {
    throw createError({ statusCode: 403, statusMessage: "Setup already completed" });
  }

  const body = await readBody(event);
  const name = String(body?.name ?? "").trim();
  const pin = String(body?.pin ?? "");
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "Name is required" });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw createError({ statusCode: 400, statusMessage: "PIN must be 4-8 digits" });
  }

  const pinHash = await hashPassword(pin);
  const maxOrder = await prisma.todoColumn.aggregate({ _max: { order: true } });

  // Mirror the user-creation shape used by /api/users (give the admin a default
  // todo column too).
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name, role: "ADMIN", pinHash },
    });
    await tx.todoColumn.create({
      data: {
        name: u.name,
        userId: u.id,
        isDefault: true,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
    });
    return u;
  });

  await setUserSession(event, {
    user: { id: user.id, name: user.name, role: user.role },
  });

  return { id: user.id, name: user.name, role: user.role };
});
