import prisma from "~/lib/prisma";

const VALID_RECURRENCE = ["ONCE", "DAILY", "WEEKLY"];

/** Create a chore. Admin only (parents define chores). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const title = String(body?.title ?? "").trim();
  const assigneeId = String(body?.assigneeId ?? "");
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }
  if (!assigneeId) {
    throw createError({ statusCode: 400, statusMessage: "assigneeId is required" });
  }

  const recurrence = VALID_RECURRENCE.includes(body?.recurrence) ? body.recurrence : "DAILY";
  const points = Math.max(0, Number.parseInt(String(body?.points), 10) || 0);
  const daysOfWeek = Array.isArray(body?.daysOfWeek)
    ? body.daysOfWeek.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
    : [];

  const maxOrder = await prisma.chore.aggregate({ _max: { order: true } });

  try {
    return await prisma.chore.create({
      data: {
        title,
        description: String(body?.description ?? "").trim() || null,
        points,
        recurrence,
        daysOfWeek: recurrence === "WEEKLY" ? daysOfWeek : [],
        assigneeId,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
    });
  }
  catch (error: any) {
    if (error?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "assignee does not exist" });
    }
    throw error;
  }
});
