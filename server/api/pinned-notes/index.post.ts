import prisma from "~/lib/prisma";

const MAX_LENGTH = 2000;

/**
 * Add a note to the Family Bulletin. Any authenticated member can post
 * (family-trust, like the message board); the author is the session user.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const raw = await readBody(event);
  const body = String(raw?.body ?? "").trim();
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Note can't be empty" });
  }
  if (body.length > MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Note too long (max ${MAX_LENGTH} characters)` });
  }

  return prisma.pinnedNote.create({
    data: { body, authorId: session.user.id },
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
  });
});
