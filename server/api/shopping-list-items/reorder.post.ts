import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { itemId, direction } = body;

    if (!itemId || !direction) {
      throw createError({
        statusCode: 400,
        message: "Item ID and direction are required",
      });
    }

    const currentItem = await prisma.shoppingListItem.findUnique({
      where: { id: itemId },
    });

    if (!currentItem) {
      throw createError({
        statusCode: 404,
        message: "Shopping list item not found",
      });
    }

    const items = await prisma.shoppingListItem.findMany({
      where: {
        shoppingListId: currentItem.shoppingListId,
      },
      orderBy: { order: "asc" },
    });

    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex === -1)
      return currentItem;

    let targetIndex;
    if (direction === "up" && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    }
    else if (direction === "down" && currentIndex < items.length - 1) {
      targetIndex = currentIndex + 1;
    }
    else {
      return currentItem;
    }

    const targetItem = items[targetIndex];
    if (!targetItem) {
      return currentItem;
    }
    const tempOrder = currentItem.order;

    await prisma.$transaction([
      prisma.shoppingListItem.update({
        where: { id: itemId },
        data: { order: targetItem.order },
      }),
      prisma.shoppingListItem.update({
        where: { id: targetItem.id },
        data: { order: tempOrder },
      }),
    ]);

    const updatedItem = await prisma.shoppingListItem.findUnique({
      where: { id: itemId },
    });

    return updatedItem;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder shopping list item: ${error}`,
    });
  }
});
