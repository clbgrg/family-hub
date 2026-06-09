import prisma from "~/lib/prisma";

const MAX_LENGTH = 2000;

/**
 * Set a member's school note for a day (upsert by member+date). A member can
 * edit only their own; an admin can edit anyone's. Empty text clears the cell.
 * Free-text + member-writable, so it's length-capped (and rendered with {{ }}).
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const body = await readBody(event);
  const userId = String(body?.userId ?? "");
  const date = String(body?.date ?? "");
  const text = String(body?.text ?? "").trim();

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date (YYYY-MM-DD) is required" });
  }
  if (session.user.role !== "ADMIN" && session.user.id !== userId) {
    throw createError({ statusCode: 403, statusMessage: "You can only edit your own school notes" });
  }

  if (!text) {
    await prisma.schoolNote.deleteMany({ where: { userId, date } });
    return { ok: true, cleared: true };
  }

  const capped = text.slice(0, MAX_LENGTH);
  try {
    return await prisma.schoolNote.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, text: capped },
      update: { text: capped },
    });
  }
  catch (error: any) {
    if (error?.code === "P2003") {
      throw createError({ statusCode: 400, statusMessage: "user does not exist" });
    }
    throw error;
  }
});
