import prisma from "~/lib/prisma";

const VALID_RECURRENCE = ["ONCE", "DAILY", "WEEKLY"];

/** Update a chore (including reassigning its members). Admin only. */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "chore id is required" });
  }

  const body = await readBody(event);
  const data: Record<string, unknown> = {};

  if (typeof body?.title === "string")
    data.title = body.title.trim();
  if ("description" in body)
    data.description = String(body.description ?? "").trim() || null;
  if (body?.points !== undefined)
    data.points = Math.max(0, Number.parseInt(String(body.points), 10) || 0);
  if (typeof body?.active === "boolean")
    data.active = body.active;
  if (body?.order !== undefined)
    data.order = Number.parseInt(String(body.order), 10) || 0;

  if (VALID_RECURRENCE.includes(body?.recurrence)) {
    data.recurrence = body.recurrence;
    data.daysOfWeek = body.recurrence === "WEEKLY" && Array.isArray(body?.daysOfWeek)
      ? body.daysOfWeek.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
      : [];
  }
  if ("areaId" in body)
    data.areaId = String(body.areaId ?? "").trim() || null;

  const dateOrNull = (v: unknown) => {
    const s = String(v ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };
  if ("startDate" in body)
    data.startDate = dateOrNull(body.startDate);
  if ("endDate" in body)
    data.endDate = dateOrNull(body.endDate);
  if ("pausedUntil" in body)
    data.pausedUntil = dateOrNull(body.pausedUntil);
  if (typeof body?.rotate === "boolean")
    data.rotate = body.rotate;
  if (typeof body?.claimable === "boolean")
    data.claimable = body.claimable;
  if ("rewardId" in body)
    data.rewardId = String(body.rewardId ?? "").trim() || null;

  const rawAssignees: unknown = body?.assigneeIds;
  let assigneeIds: string[] | null = null;
  if (Array.isArray(rawAssignees)) {
    assigneeIds = [...new Set(rawAssignees.filter((x): x is string => typeof x === "string" && !!x))];
    if (assigneeIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: "assigneeIds must include at least one member" });
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (assigneeIds) {
        await tx.choreAssignment.deleteMany({ where: { choreId: id } });
        await tx.choreAssignment.createMany({
          data: assigneeIds.map(userId => ({ choreId: id, userId })),
        });
      }
      return await tx.chore.update({
        where: { id },
        data,
        include: { assignments: true },
      });
    });
  }
  catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Chore not found" });
    }
    if (code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "assignee, area, or reward does not exist" });
    }
    throw error;
  }
});
