import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "../env";

/**
 * SSRF guard for crawling. Website URLs come from third-party data (OSM,
 * Google) and redirects, so before every request we refuse hosts that point
 * at this machine or a private network.
 */
export class BlockedUrlError extends Error {
  constructor(url: string, reason: string) {
    super(`URL no permitida (${reason}): ${url}`);
    this.name = "BlockedUrlError";
  }
}

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    if (s.startsWith("::ffff:")) return isPrivateAddress(s.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return false;
}

export async function assertPublicUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(raw, "no es una URL válida");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError(raw, "protocolo");
  if (url.username || url.password) throw new BlockedUrlError(raw, "credenciales en la URL");
  if (env().ANALYSIS_ALLOW_PRIVATE_HOSTS) return;
  if (!ALLOWED_PORTS.has(url.port)) throw new BlockedUrlError(raw, `puerto ${url.port}`);

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new BlockedUrlError(raw, "host local");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedUrlError(raw, "IP privada");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    // Unresolvable here: the request itself will fail with a clear error.
    return;
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new BlockedUrlError(raw, "resuelve a una IP privada");
}
