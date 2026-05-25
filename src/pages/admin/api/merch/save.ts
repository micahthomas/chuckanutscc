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

  const descriptionMd = str(form.get("description_md")) ?? "";
  const optionsRaw = str(form.get("options")) ?? "";
  const options = parseOptionsText(optionsRaw);
  const available = boolField(form, "available") ? 1 : 0;
  const sortOrder = intField(form, "sort_order", { min: 0 });
  const notes = str(form.get("notes"));

  const ts = now();

  const existing = await db(ctx)
    .prepare(`SELECT id FROM merch_items WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already in use.`);
  }

  let itemId: string;
  if (id) {
    itemId = id;
    await db(ctx)
      .prepare(
        `UPDATE merch_items SET slug = ?, title = ?, description_md = ?, images_json = images_json,
                                options_json = ?, available = ?, notes = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(slug, title, descriptionMd, JSON.stringify(options), available, notes, sortOrder, ts, itemId)
      .run();
  } else {
    itemId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO merch_items (id, slug, title, description_md, images_json, options_json,
                                  available, notes, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(itemId, slug, title, descriptionMd, JSON.stringify(options), available, notes, sortOrder, ts, ts)
      .run();
  }

  return seeOther(`/admin/merch/${itemId}`, id ? "Item updated." : "Item created.");
};

function parseOptionsText(text: string): Array<{ name: string; choices: string[] }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, choicesPart] = line.split(":");
      if (!name || !choicesPart) return null;
      const choices = choicesPart.split(",").map((c) => c.trim()).filter(Boolean);
      if (choices.length === 0) return null;
      return { name: name.trim(), choices };
    })
    .filter((x): x is { name: string; choices: string[] } => x !== null);
}
