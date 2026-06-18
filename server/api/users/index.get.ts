import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        todoColumn: {
          include: {
            _count: {
              select: { todos: true },
            },
          },
        },
      },
      // Custom dashboard order (admin reorder writes todoOrder); name breaks
      // ties and is the default when nobody's reordered yet.
      orderBy: [
        { todoOrder: "asc" },
        { name: "asc" },
      ],
    });
    return users;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch user: ${error}`,
    });
  }
});
