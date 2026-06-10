import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { assertPublicHttpUrl, fetchPublicText } from "../../../../server/utils/publicUrl";

describe("assertPublicHttpUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each(["ftp://example.com/cal.ics", "file:///etc/passwd", "gopher://example.com"])(
    "rejects non-http protocol %s",
    async (url) => {
      await expect(assertPublicHttpUrl(url)).rejects.toMatchObject({ statusCode: 400 });
    },
  );

  it.each([
    "http://127.0.0.1/cal.ics",
    "http://10.1.2.3/cal.ics",
    "http://192.168.1.5:3000/cal.ics",
    "http://172.16.0.1/cal.ics",
    "http://172.31.255.255/cal.ics",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/cal.ics",
    "http://0.0.0.0/cal.ics",
    "http://224.0.0.1/cal.ics",
  ])("rejects literal private/reserved IPv4 %s", async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toMatchObject({ statusCode: 400 });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://[::1]/cal.ics",
    "http://[fc00::1]/cal.ics",
    "http://[fe80::1]/cal.ics",
    "http://[::ffff:192.168.0.1]/cal.ics",
  ])("rejects private IPv6 literal %s", async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    "http://localhost/cal.ics",
    "http://localhost:3000/cal.ics",
    "http://foo.localhost/cal.ics",
    "http://printer.local/cal.ics",
    "http://db.internal/cal.ics",
  ])("rejects internal hostname %s without resolving", async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toMatchObject({ statusCode: 400 });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("accepts a public literal IPv4 without resolving", async () => {
    const url = await assertPublicHttpUrl("https://93.184.216.34/cal.ics");
    expect(url.hostname).toBe("93.184.216.34");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("accepts a hostname that resolves to a public address", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const url = await assertPublicHttpUrl("https://calendar.example.com/cal.ics");
    expect(url.hostname).toBe("calendar.example.com");
    expect(lookupMock).toHaveBeenCalledWith("calendar.example.com", { all: true, verbatim: true });
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookupMock.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    await expect(assertPublicHttpUrl("https://router.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when any resolved address is private (mixed records)", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(assertPublicHttpUrl("https://rebind.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects when DNS resolution fails", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHttpUrl("https://nope.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it("FH_ALLOW_PRIVATE_URLS=true skips the private-address check but not the protocol check", async () => {
    vi.stubEnv("FH_ALLOW_PRIVATE_URLS", "true");
    try {
      const url = await assertPublicHttpUrl("http://192.168.1.50/cal.ics");
      expect(url.hostname).toBe("192.168.1.50");
      await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toMatchObject({ statusCode: 400 });
    }
    finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("fetchPublicText", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  const response = (overrides: Partial<{ status: number; ok: boolean; body: string; location: string | null }> = {}) => {
    const { status = 200, ok = status >= 200 && status < 300, body = "", location = null } = overrides;
    return {
      status,
      ok,
      text: () => Promise.resolve(body),
      headers: { get: (name: string) => (name.toLowerCase() === "location" ? location : null) },
    };
  };

  it("returns the body for a public 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ body: "BEGIN:VCALENDAR" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicText("https://calendar.example.com/cal.ics")).resolves.toBe("BEGIN:VCALENDAR");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://calendar.example.com/cal.ics" }),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("follows a redirect to another public host", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 302, location: "https://cdn.example.com/cal.ics" }))
      .mockResolvedValueOnce(response({ body: "OK" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicText("https://calendar.example.com/cal.ics")).resolves.toBe("OK");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects when a redirect points at a private address", async () => {
    lookupMock
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]) // original host
      .mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]); // redirect target
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 302, location: "https://internal.example.com/secrets" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicText("https://calendar.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // never fetched the private hop
  });

  it("rejects a redirect to a private IP literal", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 301, location: "http://169.254.169.254/latest/meta-data/" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicText("https://calendar.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: 500 })));

    await expect(fetchPublicText("https://calendar.example.com/cal.ics"))
      .rejects.toThrow("Fetch failed: HTTP 500");
  });

  it("gives up after too many redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({ status: 302, location: "https://calendar.example.com/loop" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicText("https://calendar.example.com/cal.ics"))
      .rejects.toMatchObject({ statusCode: 400, message: "Too many redirects" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
