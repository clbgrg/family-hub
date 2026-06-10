import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { assertPublicHttpUrl } from "../../../../server/utils/publicUrl";

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
});
