import prisma from "~/lib/prisma";

const VALID_RECURRENCE = ["ONCE", "DAILY", "WEEKLY"];

/** Create a chore for one or more assignees. Admin only (parents define chores). */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const body = await readBody(event);
  const title = String(body?.title ?? "").trim();
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }
  const rawAssignees: unknown = body?.assigneeIds;
  const assigneeIds = Array.isArray(rawAssignees)
    ? [...new Set(rawAssignees.filter((x): x is string => typeof x === "string" && !!x))]
    : [];
  if (assigneeIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "assigneeIds (at least one) is required" });
  }

  const recurrence = VALID_RECURRENCE.includes(body?.recurrence) ? body.recurrence : "DAILY";
  const points = Math.max(0, Number.parseInt(String(body?.points), 10) || 0);
  const daysOfWeek = Array.isArray(body?.daysOfWeek)
    ? body.daysOfWeek.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
    : [];
  const areaId = String(body?.areaId ?? "").trim() || null;
  const dateOrNull = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  const startDate = dateOrNull(body?.startDate);
  const endDate = dateOrNull(body?.endDate);
  const pausedUntil = dateOrNull(body?.pausedUntil);
  const rotate = body?.rotate === true;

  const maxOrder = await prisma.chore.aggregate({ _max: { order: true } });

  try {
    return await prisma.chore.create({
      data: {
        title,
        description: String(body?.description ?? "").trim() || null,
        points,
        recurrence,
        daysOfWeek: recurrence === "WEEKLY" ? daysOfWeek : [],
        areaId,
        startDate,
        endDate,
        pausedUntil,
        rotate,
        order: ((maxOrder._max?.order) || 0) + 1,
        assignments: { create: assigneeIds.map(userId => ({ userId })) },
      },
      include: { assignments: true },
    });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "assignee or area does not exist" });
    }
    throw error;
  }
});
