import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, intField, boolField, slugify, seeOther, badRequest } from "~/lib/forms";

/** Turn the admin "one item per line" textarea into a JSON array of strings. */
function linesToItemsJson(raw: string | null | undefined): string {
  if (!raw) return "[]";
  const items = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

/**
 * Parse the admin CTA shorthand into a JSON array of `{label, href, primary}`.
 * Each line is `* Label | /url` (primary, orange) or `- Label | /url` (outline).
 * Anything that doesn't match the shape is silently dropped — better to lose a
 * malformed CTA than crash the save.
 */
function linesToCtasJson(raw: string | null | undefined): string {
  if (!raw) return "[]";
  const ctas = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([*-])\s*(.+?)\s*\|\s*(\S.+)$/);
      if (!match) return null;
      const [, marker, label, href] = match;
      return { label, href, primary: marker === "*" };
    })
    .filter((cta): cta is { label: string; href: string; primary: boolean } => cta !== null);
  return JSON.stringify(ctas);
}

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const title = required(form, "title");
  const slugRaw = str(form.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);
  if (!slug) return badRequest("Title or slug is required");

  const bodyMd = str(form.get("body_md")) ?? "";
  const showInNav = boolField(form, "show_in_nav") ? 1 : 0;
  const navOrder = intField(form, "nav_order", { min: 0 });
  const seoTitle = str(form.get("seo_title"));
  const seoDescription = str(form.get("seo_description"));

  const eyebrow = str(form.get("eyebrow")) ?? "";
  const subtitle = str(form.get("subtitle")) ?? "";
  const heroImageKey = str(form.get("hero_image_key"));
  const heroStatValue = str(form.get("hero_stat_value")) ?? "";
  const heroStatLabel = str(form.get("hero_stat_label")) ?? "";
  const heroItemsJson = linesToItemsJson(str(form.get("hero_items_lines")));
  const heroCtasJson = linesToCtasJson(str(form.get("hero_ctas_lines")));
  const showToc = boolField(form, "show_toc") ? 1 : 0;
  const showPrint = boolField(form, "show_print") ? 1 : 0;

  const ts = now();
  const adminEmail = ctx.locals.admin.email;

  const existing = await db(ctx)
    .prepare(`SELECT id FROM pages WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already used by another page.`);
  }

  let pageId: string;
  if (id) {
    pageId = id;
    await db(ctx)
      .prepare(
        `UPDATE pages SET slug = ?, title = ?, body_md = ?, show_in_nav = ?,
                          nav_order = ?, seo_title = ?, seo_description = ?,
                          eyebrow = ?, subtitle = ?, hero_image_key = ?,
                          hero_stat_value = ?, hero_stat_label = ?,
                          hero_items_json = ?, hero_ctas_json = ?,
                          show_toc = ?, show_print = ?,
                          updated_at = ?, updated_by = ?
         WHERE id = ?`,
      )
      .bind(
        slug, title, bodyMd, showInNav, navOrder, seoTitle, seoDescription,
        eyebrow, subtitle, heroImageKey,
        heroStatValue, heroStatLabel, heroItemsJson, heroCtasJson,
        showToc, showPrint,
        ts, adminEmail, pageId,
      )
      .run();
  } else {
    pageId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO pages (id, slug, title, body_md, show_in_nav, nav_order,
                            seo_title, seo_description,
                            eyebrow, subtitle, hero_image_key,
                            hero_stat_value, hero_stat_label,
                            hero_items_json, hero_ctas_json,
                            show_toc, show_print,
                            created_at, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pageId, slug, title, bodyMd, showInNav, navOrder,
        seoTitle, seoDescription,
        eyebrow, subtitle, heroImageKey,
        heroStatValue, heroStatLabel, heroItemsJson, heroCtasJson,
        showToc, showPrint,
        ts, ts, adminEmail,
      )
      .run();
  }

  return seeOther(`/admin/pages/${pageId}`, id ? "Page updated." : "Page created.");
};
