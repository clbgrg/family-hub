import prisma from "~/lib/prisma";

/**
 * Update a school item (parent unlock required). Editing points after
 * completion does NOT change the credited snapshot on the completion row.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "school item id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    const title = body.title.trim();
    if (!title) {
      throw createError({ statusCode: 400, statusMessage: "title cannot be empty" });
    }
    data.title = title;
  }
  if ("description" in body)
    data.description = String(body.description ?? "").trim() || null;
  if (body?.points !== undefined)
    data.points = Math.max(0, Number.parseInt(String(body.points), 10) || 0);
  if (typeof body?.dueDate === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      throw createError({ statusCode: 400, statusMessage: "dueDate must be YYYY-MM-DD" });
    }
    data.dueDate = body.dueDate;
  }
  if (typeof body?.userId === "string" && body.userId)
    data.userId = body.userId;
  if ("grade" in body)
    data.grade = String(body.grade ?? "").trim() || null;

  try {
    return await prisma.schoolItem.update({ where: { id }, data });
  }
  catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "School item not found" });
    }
    if (code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "member does not exist" });
    }
    throw error;
  }
});
