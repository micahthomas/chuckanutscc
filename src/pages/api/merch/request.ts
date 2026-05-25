import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, intField, str, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();

  const itemId = required(form, "item_id");
  const itemSlug = required(form, "item_slug");
  const name = required(form, "name");
  const email = required(form, "email");
  const quantity = intField(form, "quantity", { min: 1 });
  const notes = str(form.get("notes"));

  const item = await db(ctx)
    .prepare(`SELECT id, options_json, available FROM merch_items WHERE id = ?`)
    .bind(itemId)
    .first<{ id: string; options_json: string; available: number }>();
  if (!item) return badRequest("Item not found");
  if (item.available !== 1) return badRequest("Item is not available for requests right now");

  const options: Array<{ name: string; choices: string[] }> = JSON.parse(item.options_json || "[]");
  const selections: Record<string, string> = {};
  for (const opt of options) {
    const value = required(form, `opt_${opt.name}`);
    if (!opt.choices.includes(value)) return badRequest(`Invalid choice for ${opt.name}`);
    selections[opt.name] = value;
  }

  const ts = now();
  await db(ctx)
    .prepare(
      `INSERT INTO merch_requests (id, item_id, requester_name, requester_email,
                                   selections_json, quantity, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId(), itemId, name, email, JSON.stringify(selections), quantity, notes, ts, ts)
    .run();

  return seeOther(`/merch/${itemSlug}`, "Request submitted — we'll be in touch when the next order goes in.");
};
