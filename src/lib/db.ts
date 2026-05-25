import { env } from "cloudflare:workers";

/**
 * D1 accessor. The `_ctx` argument is accepted for backwards compatibility
 * with the pre-Astro-6 pattern of `db(Astro)` — under Astro 6 + adapter 13
 * bindings come from `cloudflare:workers` env directly, so we ignore it.
 */
export function db(_ctx?: unknown): D1Database {
  if (!env.DB) throw new Error("D1 binding 'DB' not available.");
  return env.DB;
}

export function media(_ctx?: unknown): R2Bucket {
  if (!env.MEDIA) throw new Error("R2 binding 'MEDIA' not available.");
  return env.MEDIA;
}

export const now = () => Math.floor(Date.now() / 1000);
