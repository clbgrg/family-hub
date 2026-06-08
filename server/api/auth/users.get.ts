import prisma from "~/lib/prisma";

/**
 * Minimal user list for the login picker (like an OS user-select screen).
 * Public (allowlisted) because you need it while logged out. Exposes only
 * name/avatar/color/role and a hasPin flag — never the PIN hash.
 */
export default defineEventHandler(async () => {
  const users = await prisma.user.findMany({
    orderBy: { todoOrder: "asc" },
    select: { id: true, name: true, avatar: true, color: true, role: true, pinHash: true },
  });

  return users.map(u => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    color: u.color,
    role: u.role,
    hasPin: Boolean(u.pinHash),
  }));
});
