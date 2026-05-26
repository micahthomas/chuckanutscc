import type { APIContext } from "astro";
import { env } from "cloudflare:workers";

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

/**
 * Reads the email of the admin authenticated by Cloudflare Access.
 *
 * In production, Cloudflare Access enforces auth on the /admin path and forwards
 * the user's email in a header. Locally (no Access in front), we fall back to
 * a dev override via the DEV_ADMIN_EMAIL env var so the admin UI is usable.
 *
 * Demo mode: setting DEMO_ADMIN_EMAIL on the worker treats every request as
 * that user. Bypasses Access entirely — only use it for openly shareable demo
 * deployments where every visitor is implicitly trusted as an editor.
 */
export function getAdminEmail(ctx: APIContext): string | null {
  const headerEmail = ctx.request.headers.get(ACCESS_EMAIL_HEADER);
  if (headerEmail) return headerEmail;

  const demoEmail = (env as unknown as Record<string, string | undefined>).DEMO_ADMIN_EMAIL;
  if (demoEmail) return demoEmail;

  if (import.meta.env.DEV) return "dev@localhost";

  return null;
}

export function isDemoMode(): boolean {
  return Boolean((env as unknown as Record<string, string | undefined>).DEMO_ADMIN_EMAIL);
}
