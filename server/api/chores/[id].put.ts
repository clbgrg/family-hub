import prisma from "~/lib/prisma";

const VALID_RECURRENCE = ["ONCE", "DAILY", "WEEKLY"];

/** Update a chore. Admin only. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};

  if (typeof body?.title === "string") data.title = body.title.trim();
  if ("description" in body) data.description = String(body.description ?? "").trim() || null;
  if (body?.points !== undefined) data.points = Math.max(0, Number.parseInt(String(body.points), 10) || 0);
  if (typeof body?.assigneeId === "string" && body.assigneeId) data.assigneeId = body.assigneeId;
  if (typeof body?.active === "boolean") data.active = body.active;
  if (body?.order !== undefined) data.order = Number.parseInt(String(body.order), 10) || 0;

  if (VALID_RECURRENCE.includes(body?.recurrence)) {
    data.recurrence = body.recurrence;
    data.daysOfWeek = body.recurrence === "WEEKLY" && Array.isArray(body?.daysOfWeek)
      ? body.daysOfWeek.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
      : [];
  }

  try {
    return await prisma.chore.update({ where: { id }, data });
  }
  catch (error: any) {
    if (error?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Chore not found" });
    }
    if (error?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "assignee does not exist" });
    }
    throw error;
  }
});
