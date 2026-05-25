import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { required, str, intField, boolField, seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = required(form, "id");
  const name = required(form, "name");
  const annualPriceCents = intField(form, "annual_price_cents", { min: 0 });
  const descriptionMd = str(form.get("description_md"));
  const benefitsRaw = str(form.get("benefits")) ?? "";
  const benefits = benefitsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const visible = boolField(form, "visible") ? 1 : 0;

  await db(ctx)
    .prepare(
      `UPDATE membership_tiers
         SET name = ?, annual_price_cents = ?, description_md = ?,
             benefits_json = ?, visible = ?
       WHERE id = ?`,
    )
    .bind(name, annualPriceCents, descriptionMd, JSON.stringify(benefits), visible, id)
    .run();

  return seeOther(`/admin/settings/tiers/${id}`, "Tier saved.");
};
