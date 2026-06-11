import prisma from "~/lib/prisma";

/**
 * Create a school item for one or more members (parent unlock required).
 * Multi-select fans out to ONE ROW PER MEMBER — items are single-assignee
 * (each kid has their own worksheet), unlike multi-assignee chores.
 */
export default defineEventHandler(async (event) => {
  await requireElevatedAdmin(event);

  const body = await readBody(event);
  const title = String(body?.title ?? "").trim();
  const dueDate = String(body?.dueDate ?? "");
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: "title is required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw createError({ statusCode: 400, statusMessage: "dueDate (YYYY-MM-DD) is required" });
  }
  const rawUserIds: unknown = body?.userIds;
  const userIds = Array.isArray(rawUserIds)
    ? [...new Set(rawUserIds.filter((x): x is string => typeof x === "string" && !!x))]
    : [];
  if (userIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "userIds (at least one) is required" });
  }

  const points = Math.max(0, Number.parseInt(String(body?.points), 10) || 0);
  const description = String(body?.description ?? "").trim() || null;

  try {
    return await prisma.$transaction(
      userIds.map(userId =>
        prisma.schoolItem.create({
          data: { title, description, points, dueDate, userId },
        }),
      ),
    );
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "member does not exist" });
    }
    throw error;
  }
});
