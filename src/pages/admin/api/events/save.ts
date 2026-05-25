import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, intOpt, slugify, seeOther, pacificDateTimeField, pacificDateTimeOpt, badRequest } from "~/lib/forms";
import { upsertEventReminders, cancelEventReminders } from "~/lib/mutations";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const title = required(form, "title");
  const slugRaw = str(form.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);
  if (!slug) return badRequest("Title or slug is required");

  const eventType = required(form, "event_type");
  const status = required(form, "status");
  const startAt = pacificDateTimeField(form, "start_at");
  const endAt = pacificDateTimeOpt(form, "end_at");
  const seasonId = str(form.get("season_id"));
  const locationId = str(form.get("location_id"));
  const locationName = str(form.get("location_name"));
  const locationAddress = str(form.get("location_address"));
  const locationMapUrl = str(form.get("location_map_url"));
  const descriptionMd = str(form.get("description_md")) ?? "";
  const registrationUrl = str(form.get("registration_url"));
  const resultsUrl = str(form.get("results_url"));
  const heroImageKey = str(form.get("hero_image_key"));
  const courseMapImageKey = str(form.get("course_map_image_key"));
  const runGroupsRaw = str(form.get("run_groups"));
  const runGroupsJson = runGroupsRaw
    ? JSON.stringify(runGroupsRaw.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  const feeMember = intOpt(form, "fee_member_cents");
  const feeNonMember = intOpt(form, "fee_nonmember_cents");

  const ts = now();
  const adminEmail = ctx.locals.admin.email;

  // Slug uniqueness check (excluding self if editing).
  const existing = await db(ctx)
    .prepare(`SELECT id FROM events WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already used by another event.`);
  }

  let eventId: string;
  if (id) {
    eventId = id;
    await db(ctx)
      .prepare(
        `UPDATE events SET
           slug = ?, title = ?, event_type = ?, status = ?, start_at = ?, end_at = ?,
           season_id = ?,
           location_id = ?, location_name = ?, location_address = ?, location_map_url = ?,
           description_md = ?, registration_url = ?, results_url = ?,
           run_groups_json = ?, fee_member_cents = ?, fee_nonmember_cents = ?,
           hero_image_key = ?, course_map_image_key = ?,
           updated_at = ?, updated_by = ?
         WHERE id = ?`,
      )
      .bind(
        slug, title, eventType, status, startAt, endAt,
        seasonId,
        locationId, locationName, locationAddress, locationMapUrl,
        descriptionMd, registrationUrl, resultsUrl,
        runGroupsJson, feeMember, feeNonMember,
        heroImageKey, courseMapImageKey,
        ts, adminEmail, eventId,
      )
      .run();
  } else {
    eventId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO events (id, slug, title, event_type, status, start_at, end_at,
                             season_id,
                             location_id, location_name, location_address, location_map_url,
                             description_md, registration_url, results_url,
                             run_groups_json, fee_member_cents, fee_nonmember_cents,
                             hero_image_key, course_map_image_key,
                             created_at, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        eventId, slug, title, eventType, status, startAt, endAt,
        seasonId,
        locationId, locationName, locationAddress, locationMapUrl,
        descriptionMd, registrationUrl, resultsUrl,
        runGroupsJson, feeMember, feeNonMember,
        heroImageKey, courseMapImageKey,
        ts, ts, adminEmail,
      )
      .run();
  }

  if (status === "cancelled") {
    await cancelEventReminders(ctx, eventId);
  } else if (status === "scheduled" || status === "postponed") {
    await upsertEventReminders(ctx, eventId, startAt);
  }

  return seeOther(`/admin/events/${eventId}`, id ? "Event updated." : "Event created.");
};
