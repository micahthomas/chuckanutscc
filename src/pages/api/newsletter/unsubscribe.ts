import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";

/** GET so unsubscribe links in emails work with a single click. */
export const GET: APIRoute = async (ctx) => {
  const token = ctx.url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const result = await db(ctx)
    .prepare(
      `UPDATE newsletter_subscribers
         SET unsubscribed_at = ?
       WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL`,
    )
    .bind(now(), token)
    .run();

  const ok = result.meta.changes > 0;
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:32rem;margin:auto">
       <h1>${ok ? "Unsubscribed" : "Already unsubscribed"}</h1>
       <p>${ok ? "You won't get any more emails from us." : "You're already off the list."}</p>
       <p><a href="/">← Back to chuckanutscc.org</a></p>
     </body></html>`,
    { headers: { "content-type": "text/html" } },
  );
};
