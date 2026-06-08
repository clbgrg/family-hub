import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const listId = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!listId) {
      throw createError({
        statusCode: 400,
        message: "Shopping list ID is required",
      });
    }

    if (body.action !== "delete") {
      throw createError({
        statusCode: 400,
        message: "Invalid action",
      });
    }

    await prisma.shoppingListItem.deleteMany({
      where: {
        shoppingListId: listId,
        checked: true,
      },
    });

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to clear completed items: ${error}`,
    });
  }
});
