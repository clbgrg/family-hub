import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const columnId = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!columnId) {
      throw createError({
        statusCode: 400,
        message: "Todo column ID is required",
      });
    }

    if (body.action !== "delete") {
      throw createError({
        statusCode: 400,
        message: "Invalid action",
      });
    }

    await prisma.todo.deleteMany({
      where: {
        todoColumnId: columnId,
        completed: true,
      },
    });

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to clear completed todos: ${error}`,
    });
  }
});
