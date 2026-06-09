import { Role } from "@prisma/client";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  // Guard against deleting the last admin (lockout). Before the try so the
  // 409/404 isn't swallowed by the catch-all below.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }
  if (target.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: "Can't delete the last admin" });
    }
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        todoColumn: {
          include: {
            todos: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        message: "User not found",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (existingUser.todoColumn && existingUser.todoColumn.todos.length > 0) {
        await tx.todo.deleteMany({
          where: { todoColumnId: existingUser.todoColumn.id },
        });
      }

      if (existingUser.todoColumn) {
        await tx.todoColumn.delete({
          where: { id: existingUser.todoColumn.id },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to delete user: ${error}`,
    });
  }
});
