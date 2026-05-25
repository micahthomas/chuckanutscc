import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, intField, boolField, slugify, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const year = intField(form, "year", { min: 1900 });
  const name = required(form, "name");
  const slugRaw = str(form.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : String(year);
  if (!slug) return badRequest("Slug is required");
  const descriptionMd = str(form.get("description_md")) ?? "";
  const scorekeeperSeries = str(form.get("scorekeeper_series"));
  const isCurrent = boolField(form, "is_current") ? 1 : 0;

  const ts = now();

  const existing = await db(ctx)
    .prepare(`SELECT id FROM seasons WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already in use.`);
  }

  // If this row becomes the current one, clear the flag on every other row first.
  if (isCurrent) {
    await db(ctx).prepare(`UPDATE seasons SET is_current = 0`).run();
  }

  let seasonId: string;
  if (id) {
    seasonId = id;
    await db(ctx)
      .prepare(
        `UPDATE seasons SET slug = ?, year = ?, name = ?, description_md = ?,
                            scorekeeper_series = ?, is_current = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(slug, year, name, descriptionMd, scorekeeperSeries, isCurrent, ts, seasonId)
      .run();
  } else {
    seasonId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO seasons (id, slug, year, name, description_md, scorekeeper_series,
                              is_current, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(seasonId, slug, year, name, descriptionMd, scorekeeperSeries, isCurrent, ts, ts)
      .run();
  }

  return seeOther(`/admin/seasons/${seasonId}`, id ? "Season updated." : "Season created.");
};
