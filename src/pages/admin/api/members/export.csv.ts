import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { fmtDate } from "~/lib/format";

export const GET: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });

  const filter = ctx.url.searchParams.get("filter") ?? "active";
  const ts = now();
  const where = filter === "active" ? "WHERE m.expires_at >= ?" : filter === "expired" ? "WHERE m.expires_at < ?" : "";
  const binds: unknown[] = filter === "all" ? [] : [ts];

  const { results } = await db(ctx)
    .prepare(
      `SELECT m.name, m.email, m.phone, m.city, m.car_info, m.expires_at,
              t.name AS tier_name
       FROM members m
       LEFT JOIN membership_tiers t ON t.id = m.tier_id
       ${where}
       ORDER BY m.name ASC`,
    )
    .bind(...binds)
    .all<{ name: string; email: string; phone: string | null; city: string | null;
            car_info: string | null; expires_at: number | null; tier_name: string | null }>();

  const header = "Name,Email,Phone,City,Car,Tier,Expires";
  const rows = results.map((r) =>
    [r.name, r.email, r.phone ?? "", r.city ?? "", r.car_info ?? "",
     r.tier_name ?? "", r.expires_at ? fmtDate(r.expires_at) : ""]
      .map(csvEscape).join(","));

  const body = [header, ...rows].join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="members-${filter}-${Date.now()}.csv"`,
    },
  });
};

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
