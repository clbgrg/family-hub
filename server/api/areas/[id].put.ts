import prisma from "~/lib/prisma";

/** Update a chore area (name / icon / order). Admin only. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "area id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string")
    data.name = body.name.trim();
  if ("icon" in body)
    data.icon = String(body.icon ?? "").trim() || null;
  if (body?.order !== undefined)
    data.order = Number.parseInt(String(body.order), 10) || 0;

  if (data.name === "") {
    throw createError({ statusCode: 400, statusMessage: "name cannot be empty" });
  }

  try {
    return await prisma.area.update({ where: { id }, data });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Area not found" });
    }
    throw error;
  }
});
