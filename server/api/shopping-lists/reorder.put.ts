import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { listIds } = body;

    const updatePromises = listIds.map((id: string, index: number) =>
      prisma.shoppingList.update({
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
      message: `Failed to reorder shopping list: ${error}`,
    });
  }
});
