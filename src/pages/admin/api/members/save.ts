import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, boolField, pacificDateTimeOpt, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const name = required(form, "name");
  const email = required(form, "email");
  const phone = str(form.get("phone"));
  const addressLine1 = str(form.get("address_line1"));
  const addressLine2 = str(form.get("address_line2"));
  const city = str(form.get("city"));
  const state = str(form.get("state"))?.toUpperCase() ?? null;
  const postalCode = str(form.get("postal_code"));
  const carInfo = str(form.get("car_info"));
  const familyMemberName = str(form.get("family_member_name"));
  const tierId = str(form.get("tier_id"));
  const expiresAt = pacificDateTimeOpt(form, "expires_at");
  const newsletterOptIn = boolField(form, "newsletter_opt_in") ? 1 : 0;
  const notes = str(form.get("notes"));

  const ts = now();

  const existing = await db(ctx)
    .prepare(`SELECT id FROM members WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`A member with email ${email} already exists.`);
  }

  let memberId: string;
  if (id) {
    memberId = id;
    await db(ctx)
      .prepare(
        `UPDATE members SET name = ?, email = ?, phone = ?,
                            address_line1 = ?, address_line2 = ?, city = ?, state = ?, postal_code = ?,
                            car_info = ?, family_member_name = ?,
                            tier_id = ?, expires_at = ?, newsletter_opt_in = ?, notes = ?,
                            updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        name, email, phone,
        addressLine1, addressLine2, city, state, postalCode,
        carInfo, familyMemberName,
        tierId, expiresAt, newsletterOptIn, notes,
        ts, memberId,
      )
      .run();
  } else {
    memberId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO members (id, name, email, phone,
                              address_line1, address_line2, city, state, postal_code,
                              car_info, family_member_name,
                              tier_id, expires_at, joined_at, newsletter_opt_in, notes,
                              created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        memberId, name, email, phone,
        addressLine1, addressLine2, city, state, postalCode,
        carInfo, familyMemberName,
        tierId, expiresAt, ts, newsletterOptIn, notes,
        ts, ts,
      )
      .run();
  }

  return seeOther(`/admin/members/${memberId}`, id ? "Member updated." : "Member added.");
};
