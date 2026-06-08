import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Shopping list ID is required",
      });
    }

    const shoppingList = await prisma.shoppingList.update({
      where: { id },
      data: {
        name: body.name,
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return shoppingList;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update shopping list: ${error}`,
    });
  }
});
