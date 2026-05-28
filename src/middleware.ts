import { defineMiddleware } from "astro:middleware";
import { getAdminEmail } from "~/lib/auth";

export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.admin = null;

  if (ctx.url.pathname.startsWith("/admin")) {
    const email = getAdminEmail(ctx);
    if (!email) {
      // In production Cloudflare Access blocks before reaching us. This is a
      // safety net — only fires if Access is misconfigured or in local dev
      // without a DEV_ADMIN_EMAIL set.
      return new Response("Unauthorized", { status: 401 });
    }
    ctx.locals.admin = { email };
  }

  const res = await next();

  // The /p/<token>/* and /api/p/<token>/* paths are secret-URL-gated; ensure
  // intermediates and crawlers don't cache or index them.
  if (ctx.url.pathname.startsWith("/p/") || ctx.url.pathname.startsWith("/api/p/")) {
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex,nofollow");
  }

  return res;
});
