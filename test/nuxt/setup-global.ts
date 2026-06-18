import type { H3Event } from "h3";

import { vi } from "vitest";

import type { Handler } from "../types/h3-test";

const defineEventHandlerMock = vi.fn((handler: Handler) => handler);
const readBodyMock = vi.fn(async (event: H3Event) => {
  if (event._requestBody && typeof event._requestBody === "string") {
    return JSON.parse(event._requestBody);
  }
  return event._requestBody || {};
});
const getRouterParamsMock = vi.fn((event: H3Event) => event.context?.params || {});
const getRouterParamMock = vi.fn(
  (event: H3Event, name: string) => event.context?.params?.[name],
);
const getQueryMock = vi.fn((event: H3Event) => event.context?.query || {});
const setResponseHeadersMock = vi.fn((event: H3Event, headers: Record<string, string>) => {
  if (event.node.res && typeof event.node.res.setHeader === "function") {
    Object.entries(headers).forEach(([key, value]) => {
      event.node.res.setHeader(key, value);
    });
  }
});

// Auth gate is exercised end-to-end against the running stack; in unit tests we
// stub it to a passing admin so handler logic is tested in isolation.
const requireAdminMock = vi.fn(async () => ({
  user: { id: "test-admin", name: "Test Admin", role: "ADMIN" },
}));
const requireElevatedAdminMock = vi.fn(async () => ({
  user: { id: "test-admin", name: "Test Admin", role: "ADMIN" },
  elevatedUntil: Date.now() + 300_000,
}));
const requireUserSessionMock = vi.fn(async () => ({
  user: { id: "test-user", name: "Test User", role: "MEMBER" },
}));

vi.stubGlobal("defineEventHandler", defineEventHandlerMock);
vi.stubGlobal("readBody", readBodyMock);
vi.stubGlobal("getRouterParams", getRouterParamsMock);
vi.stubGlobal("getRouterParam", getRouterParamMock);
vi.stubGlobal("getQuery", getQueryMock);
vi.stubGlobal("setResponseHeaders", setResponseHeadersMock);
vi.stubGlobal("requireAdmin", requireAdminMock);
vi.stubGlobal("requireElevatedAdmin", requireElevatedAdminMock);
vi.stubGlobal("requireUserSession", requireUserSessionMock);

class EventSourceMock {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  onopen: ((this: EventSourceMock, ev: Event) => void) | null = null;
  onmessage: ((this: EventSourceMock, ev: MessageEvent) => void) | null = null;
  onerror: ((this: EventSourceMock, ev: Event) => void) | null = null;
  readyState = EventSourceMock.CONNECTING;
  url = "";

  constructor(url: string) {
    this.url = url;
  }

  close(): void {
    this.readyState = EventSourceMock.CLOSED;
  }
}

if (typeof globalThis.EventSource === "undefined") {
  vi.stubGlobal("EventSource", EventSourceMock);
}
