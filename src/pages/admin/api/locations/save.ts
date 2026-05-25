import type { APIRoute } from "astro";
import { db, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { required, str, intField, boolField, slugify, seeOther, badRequest } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const id = str(form.get("id"));
  const name = required(form, "name");
  const slugRaw = str(form.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  if (!slug) return badRequest("Name or slug is required");

  const address = str(form.get("address"));
  const latRaw = str(form.get("latitude"));
  const lngRaw = str(form.get("longitude"));
  const latitude = latRaw ? Number.parseFloat(latRaw) : null;
  const longitude = lngRaw ? Number.parseFloat(lngRaw) : null;
  if ((latRaw && Number.isNaN(latitude!)) || (lngRaw && Number.isNaN(longitude!))) {
    return badRequest("Latitude/longitude must be numbers");
  }
  const mapImageKey = str(form.get("map_image_key"));
  const descriptionMd = str(form.get("description_md")) ?? "";
  const directionsMd = str(form.get("directions_md")) ?? "";
  const sortOrder = intField(form, "sort_order", { min: 0 });
  const active = boolField(form, "active") ? 1 : 0;

  const ts = now();

  const existing = await db(ctx)
    .prepare(`SELECT id FROM locations WHERE slug = ?`)
    .bind(slug)
    .first<{ id: string }>();
  if (existing && existing.id !== id) {
    return badRequest(`Slug "${slug}" is already in use.`);
  }

  let locId: string;
  if (id) {
    locId = id;
    await db(ctx)
      .prepare(
        `UPDATE locations SET slug = ?, name = ?, address = ?, latitude = ?, longitude = ?,
                              map_image_key = ?, description_md = ?, directions_md = ?,
                              sort_order = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(slug, name, address, latitude, longitude, mapImageKey, descriptionMd, directionsMd,
            sortOrder, active, ts, locId)
      .run();
  } else {
    locId = newId();
    await db(ctx)
      .prepare(
        `INSERT INTO locations (id, slug, name, address, latitude, longitude,
                                map_image_key, description_md, directions_md,
                                sort_order, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(locId, slug, name, address, latitude, longitude, mapImageKey, descriptionMd, directionsMd,
            sortOrder, active, ts, ts)
      .run();
  }

  return seeOther(`/admin/locations/${locId}`, id ? "Location updated." : "Location created.");
};
