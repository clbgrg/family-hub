import prisma from "~/lib/prisma";

/**
 * First-run check: is there no admin yet? If so the client routes to /setup.
 * Public (allowlisted in server/middleware/auth.ts) so a logged-out, unset-up
 * instance can bootstrap.
 */
export default defineEventHandler(async () => {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  return { needsSetup: adminCount === 0 };
});
