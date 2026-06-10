import type { H3Event } from "h3";

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserSessionMock = vi.fn(async () => ({
  user: { id: "test-user", name: "Test User", role: "MEMBER" },
}));
vi.stubGlobal("requireUserSession", requireUserSessionMock);

import handler from "~~/server/middleware/auth";

const eventFor = (path: string) => ({ path }) as unknown as H3Event;

describe("server auth middleware", () => {
  beforeEach(() => {
    requireUserSessionMock.mockClear();
  });

  it.each([
    "/",
    "/calendar",
    "/_nuxt/entry.js",
  ])("skips non-API route %s", async (path) => {
    await handler(eventFor(path));
    expect(requireUserSessionMock).not.toHaveBeenCalled();
  });

  it.each([
    "/api/_auth/session",
    "/api/auth/login",
    "/api/auth/setup",
    "/api/auth/users",
  ])("allowlists %s for the logged-out flow", async (path) => {
    await handler(eventFor(path));
    expect(requireUserSessionMock).not.toHaveBeenCalled();
  });

  it.each([
    "/api/users",
    "/api/integrations/mealie/recipes",
    "/api/integrations/tandoor/recipe/1",
    "/api/integrations/iCal",
    "/api/sync/events",
    "/api/calendar-events",
  ])("requires a session for %s", async (path) => {
    await handler(eventFor(path));
    expect(requireUserSessionMock).toHaveBeenCalledTimes(1);
  });

  it("propagates the 401 from requireUserSession", async () => {
    requireUserSessionMock.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    );
    await expect(handler(eventFor("/api/integrations/mealie/recipes")))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("does not treat /api/authx as allowlisted", async () => {
    await handler(eventFor("/api/authx/whatever"));
    expect(requireUserSessionMock).toHaveBeenCalledTimes(1);
  });
});
