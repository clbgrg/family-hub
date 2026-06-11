import { Role } from "@prisma/client";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  try {
    const body = await readBody(event);
    const role = Object.values(Role).includes(body.role) ? (body.role as Role) : Role.MEMBER;

    const maxOrder = await prisma.todoColumn.aggregate({
      _max: {
        order: true,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          role,
        },
      });

      const todoColumn = await tx.todoColumn.create({
        data: {
          name: user.name,
          userId: user.id,
          isDefault: true,
          order: ((maxOrder._max?.order) || 0) + 1,
        },
      });

      return { user, todoColumn };
    });

    return result.user;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create user: ${error}`,
    });
  }
});
