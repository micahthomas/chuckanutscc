import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, boolField, slugify, seeOther, badRequest } from "~/lib/forms";
import { generateUploadToken } from "~/lib/tokens";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const name = required(form, "name");
  const slugRaw = str(form.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) return badRequest("Name or slug is required");

  const bioMd = str(form.get("bio_md"));
  const portfolioUrl = str(form.get("portfolio_url"));
  const instagramUrl = str(form.get("instagram_url"));
  const contactEmail = str(form.get("contact_email"));
  const active = boolField(form, "active") ? 1 : 0;

  const ts = now();

  const existing = await db(ctx)
    .prepare(`SELECT id FROM photographers WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already in use.`);
  }

  let pId: string;
  if (id) {
    pId = id;
    await db(ctx)
      .prepare(
        `UPDATE photographers SET slug = ?, name = ?, bio_md = ?, portfolio_url = ?,
                                  instagram_url = ?, contact_email = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(slug, name, bioMd, portfolioUrl, instagramUrl, contactEmail, active, ts, pId)
      .run();
  } else {
    pId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO photographers (id, slug, name, bio_md, portfolio_url, instagram_url,
                                    contact_email, active, upload_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(pId, slug, name, bioMd, portfolioUrl, instagramUrl, contactEmail, active, generateUploadToken(), ts, ts)
      .run();
  }

  return seeOther(`/admin/photographers/${pId}`, id ? "Photographer updated." : "Photographer added.");
};
