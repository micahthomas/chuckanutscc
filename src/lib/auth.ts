import type { APIContext } from "astro";

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

/**
 * Reads the email of the admin authenticated by Cloudflare Access.
 *
 * In production, Cloudflare Access enforces auth on the /admin path and forwards
 * the user's email in a header. Locally (no Access in front), we fall back to
 * a dev override via the DEV_ADMIN_EMAIL env var so the admin UI is usable.
 */
export function getAdminEmail(ctx: APIContext): string | null {
  const headerEmail = ctx.request.headers.get(ACCESS_EMAIL_HEADER);
  if (headerEmail) return headerEmail;

  if (import.meta.env.DEV) return "dev@localhost";

  return null;
}
