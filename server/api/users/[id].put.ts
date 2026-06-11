import { Role } from "@prisma/client";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID is required" });
  }
  const body = await readBody(event);

  // Validate role and guard against removing the last admin (lockout).
  let roleUpdate: Role | undefined;
  if (body.role !== undefined) {
    if (!Object.values(Role).includes(body.role)) {
      throw createError({ statusCode: 400, statusMessage: "role must be ADMIN or MEMBER" });
    }
    roleUpdate = body.role as Role;
    if (roleUpdate === Role.MEMBER) {
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === Role.ADMIN) {
        const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
        if (adminCount <= 1) {
          throw createError({ statusCode: 409, statusMessage: "Can't remove the last admin" });
        }
      }
    }
  }

  try {
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          todoOrder: body.todoOrder ?? undefined,
          ...(roleUpdate ? { role: roleUpdate } : {}),
        },
      }),
      ...(body.name
        ? [
            prisma.todoColumn.updateMany({
              where: { userId: id },
              data: { name: body.name },
            }),
          ]
        : []),
    ]);
    return updatedUser;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update user: ${error}`,
    });
  }
});
