import { getRequestHost } from "h3";
import os from "node:os";

/**
 * Resolve the URL phones on the LAN should use to reach the app.
 *
 * Order:
 *   1. NUXT_APP_PUBLIC_URL (runtimeConfig.appPublicUrl) — the only reliable
 *      option in Docker, where the container only sees its 172.x bridge IP.
 *   2. First non-internal IPv4 from the host's interfaces, preferring
 *      non-Docker ranges. Works for bare-node / host-network / dev setups.
 *   3. null — client decides (falls back to window.location.origin when that
 *      isn't localhost, otherwise shows setup guidance).
 *
 * Session required (global auth middleware covers /api/system/*).
 */
export default defineEventHandler((event) => {
  const configured = useRuntimeConfig(event).appPublicUrl?.trim();
  if (configured) {
    return { url: configured.replace(/\/+$/, ""), source: "env" as const };
  }

  const candidates: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal)
        candidates.push(addr.address);
    }
  }
  // Docker bridge addresses (172.16.0.0/12) are unreachable from the LAN;
  // only use one if nothing better exists (then it's likely wrong anyway,
  // but a wrong guess beats nothing only outside that range — so drop them
  // entirely when they're the sole candidates inside a container).
  const isDockerish = (ip: string) => {
    const [a, b] = ip.split(".").map(Number);
    return a === 172 && b !== undefined && b >= 16 && b <= 31;
  };
  const lanIp = candidates.find(ip => !isDockerish(ip));
  if (!lanIp)
    return { url: null, source: null };

  // Keep whatever port the client is currently using (kiosk and phone share it).
  const hostHeader = getRequestHost(event, { xForwardedHost: true });
  const port = hostHeader.includes(":") ? hostHeader.split(":").pop() : "";
  return {
    url: `http://${lanIp}${port ? `:${port}` : ""}`,
    source: "interface" as const,
  };
});
