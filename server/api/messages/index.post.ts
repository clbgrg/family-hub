import prisma from "~/lib/prisma";

const MAX_LENGTH = 1000;
const EXPIRY_DAYS = 7;

/**
 * Post a note to the family board. Any authenticated member can post (this is
 * the one member-writable free-text field), so validate it server-side:
 * non-empty after trim, and a hard length cap. The author is the session user.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const body = String((await readBody(event))?.body ?? "").trim();
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Message can't be empty" });
  }
  if (body.length > MAX_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Message too long (max ${MAX_LENGTH} characters)` });
  }

  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return prisma.message.create({
    data: { body, authorId: session.user.id, expiresAt },
    include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
  });
});
