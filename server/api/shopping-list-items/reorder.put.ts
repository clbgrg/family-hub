import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { itemIds } = body;

    if (!itemIds || !Array.isArray(itemIds)) {
      throw createError({
        statusCode: 400,
        message: "Item IDs array is required",
      });
    }

    const updatePromises = itemIds.map((id: string, index: number) =>
      prisma.shoppingListItem.update({
        where: { id },
        data: { order: index },
      }),
    );

    await Promise.all(updatePromises);

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder shopping list item: ${error}`,
    });
  }
});
