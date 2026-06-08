import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { userIds } = await readBody(event);

    if (!Array.isArray(userIds)) {
      throw createError({
        statusCode: 400,
        message: "userIds must be an array",
      });
    }

    const updates = userIds.map((userId, index) => {
      return prisma.user.update({
        where: { id: userId },
        data: { todoOrder: index },
      });
    });

    await prisma.$transaction(updates);

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder users: ${error}`,
    });
  }
});
