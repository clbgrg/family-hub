import prisma from "~/lib/prisma";

const MAX_LENGTH = 2000;

/**
 * Edit a Family Bulletin note. Any authenticated member can edit (family-trust,
 * matching the board's any-member delete). 404 if the note is gone.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "note id is required" });
  }

  const raw = await readBody(event);
  const body = String(raw?.body ?? "").trim();
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Note can't be empty" });
  }
  if (body.length > MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Note too long (max ${MAX_LENGTH} characters)` });
  }

  try {
    return await prisma.pinnedNote.update({
      where: { id },
      data: { body },
      include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
    });
  }
  catch (error) {
    if ((error as { code?: string })?.code === "P2025") {
      throw createError({ statusCode: 404, statusMessage: "Note not found" });
    }
    throw error;
  }
});
