import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { fmtDate } from "~/lib/format";

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });

  const includeInactive = ctx.url.searchParams.get("inactive") === "1";
  const where = includeInactive ? "" : "WHERE unsubscribed_at IS NULL";

  const { results } = await db(ctx)
    .prepare(
      `SELECT email, name, source, subscribed_at, unsubscribed_at
       FROM newsletter_subscribers ${where}
       ORDER BY subscribed_at DESC`,
    )
    .all<{ email: string; name: string | null; source: string | null;
            subscribed_at: number; unsubscribed_at: number | null }>();

  const header = "Email,Name,Source,Subscribed,Unsubscribed";
  const rows = results.map((r) =>
    [r.email, r.name ?? "", r.source ?? "", fmtDate(r.subscribed_at),
     r.unsubscribed_at ? fmtDate(r.unsubscribed_at) : ""].map(csv).join(","));

  return new Response([header, ...rows].join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="subscribers-${Date.now()}.csv"`,
    },
  });
};

const csv = (v: string) =>
  /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
