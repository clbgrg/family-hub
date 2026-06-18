import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/pinned-notes/index.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/pinned-notes", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  it("creates a trimmed note authored by the session user", async () => {
    const created = {
      id: "n1",
      body: "Field trip Friday",
      authorId: "test-user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.pinnedNote.create.mockResolvedValue(created);

    const event = createMockH3Event({ body: { body: "  Field trip Friday  " } });
    const res = await handler(event);

    expect(prisma.pinnedNote.create).toHaveBeenCalledWith({
      data: { body: "Field trip Friday", authorId: "test-user" },
      include: { author: { select: { id: true, name: true, avatar: true, color: true } } },
    });
    expect(res).toEqual(created);
  });

  it("rejects an empty note (400)", async () => {
    const event = createMockH3Event({ body: { body: "   " } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an over-long note (400)", async () => {
    const event = createMockH3Event({ body: { body: "x".repeat(2001) } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
  });
});
