import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, intField, boolField, slugify, seeOther, badRequest } from "~/lib/forms";

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
                          updated_at = ?, updated_by = ?
         WHERE id = ?`,
      )
      .bind(slug, title, bodyMd, showInNav, navOrder, seoTitle, seoDescription, ts, adminEmail, pageId)
      .run();
  } else {
    pageId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO pages (id, slug, title, body_md, show_in_nav, nav_order,
                            seo_title, seo_description, created_at, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(pageId, slug, title, bodyMd, showInNav, navOrder, seoTitle, seoDescription, ts, ts, adminEmail)
      .run();
  }

  return seeOther(`/admin/pages/${pageId}`, id ? "Page updated." : "Page created.");
};
