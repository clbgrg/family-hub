import { createError } from "h3";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for user-supplied fetch targets (iCal URLs). Rejects anything
 * that is not plain http(s) or that points at a private / internal address,
 * so the server can't be used to probe the home network, localhost, or cloud
 * metadata endpoints.
 *
 * Known residual risks (accepted, see docs/skylite-ux-review.md §A2):
 * - DNS rebinding: we resolve once to validate; fetch resolves again.
 * - Redirects: a public URL may redirect to a private one (fetch follows).
 */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // not a clean IPv4 — treat as unsafe
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 // "this" network
    || a === 10 // RFC1918
    || a === 127 // loopback
    || (a === 100 && b >= 64 && b <= 127) // CGNAT
    || (a === 169 && b === 254) // link-local / cloud metadata
    || (a === 172 && b >= 16 && b <= 31) // RFC1918
    || (a === 192 && b === 168) // RFC1918
    || (a === 192 && b === 0) // IETF protocol assignments
    || (a === 198 && (b === 18 || b === 19)) // benchmarking
    || a >= 224 // multicast + reserved + broadcast
  );
}

/** Extract the IPv4 part of an IPv4-mapped IPv6 address (dotted or hex form). */
function mappedIPv4(lower: string): string | null {
  if (!lower.startsWith("::ffff:")) {
    return null;
  }
  const rest = lower.slice("::ffff:".length);
  if (rest.includes(".")) {
    return rest; // ::ffff:10.0.0.1
  }
  const parts = rest.split(":"); // URL normalizes to hex: ::ffff:c0a8:1
  if (parts.length === 2) {
    const hi = Number.parseInt(parts[0]!, 16);
    const lo = Number.parseInt(parts[1]!, 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
  }
  return null;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isPrivateIPv4(address);
  }
  const lower = address.toLowerCase();
  const mapped = mappedIPv4(lower);
  if (mapped) {
    return isPrivateIPv4(mapped);
  }
  if (lower === "::" || lower === "::1") {
    return true; // unspecified / loopback
  }
  const firstHextet = Number.parseInt(lower.split(":")[0] || "", 16);
  if (!Number.isFinite(firstHextet)) {
    return true; // unparseable — fail closed
  }
  return (
    (firstHextet & 0xFE00) === 0xFC00 // fc00::/7 unique-local
    || (firstHextet & 0xFFC0) === 0xFE80 // fe80::/10 link-local
    || (firstHextet & 0xFFC0) === 0xFEC0 // fec0::/10 deprecated site-local
  );
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  }
  catch {
    throw createError({ statusCode: 400, message: "Invalid URL" });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw createError({ statusCode: 400, message: "URL must use http or https" });
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
  ) {
    throw createError({ statusCode: 400, message: "URL must not point at a private address" });
  }

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  }
  else {
    try {
      const results = await lookup(hostname, { all: true, verbatim: true });
      addresses = results.map(r => r.address);
    }
    catch {
      throw createError({ statusCode: 400, message: "Could not resolve URL host" });
    }
  }

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw createError({ statusCode: 400, message: "URL must not point at a private address" });
  }

  return url;
}
