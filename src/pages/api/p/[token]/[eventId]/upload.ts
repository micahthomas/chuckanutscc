import type { APIRoute } from "astro";
import { db, media, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { assertPhotographerEvent } from "~/lib/photographer-auth";

const MAX_THUMB_BYTES   = 300 * 1024;          //   300 KB
const MAX_DISPLAY_BYTES = 2 * 1024 * 1024;     //   2 MB
const MAX_FULL_BYTES    = 60 * 1024 * 1024;    //  60 MB — large originals welcome

const FULL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
]);

function extFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "image/avif") return "avif";
  return "bin";
}

function intFieldOpt(form: FormData, name: string): number | null {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async (ctx) => {
  const token = ctx.params.token as string;
  const eventId = ctx.params.eventId as string;

  let session;
  try {
    session = await assertPhotographerEvent(ctx, token, eventId);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  const { photographer, event } = session;

  const form = await ctx.request.formData();
  const thumb   = form.get("thumb");
  const display = form.get("display");
  const full    = form.get("full");
  const filename = (form.get("filename") as string | null)?.trim() || "upload";

  if (!(thumb instanceof File) || !(display instanceof File) || !(full instanceof File)) {
    return Response.json({ error: "Missing thumb/display/full blob" }, { status: 400 });
  }
  if (thumb.size > MAX_THUMB_BYTES) {
    return Response.json({ error: `Thumb too large (${thumb.size} bytes)` }, { status: 413 });
  }
  if (display.size > MAX_DISPLAY_BYTES) {
    return Response.json({ error: `Display too large (${display.size} bytes)` }, { status: 413 });
  }
  if (full.size > MAX_FULL_BYTES) {
    return Response.json({ error: `Original too large (${full.size} bytes)` }, { status: 413 });
  }
  if (!FULL_TYPES.has(full.type)) {
    return Response.json({ error: `Unsupported original type ${full.type}` }, { status: 400 });
  }

  const photoId = newId();
  const baseKey = `events/${event.id}/${photoId}`;
  const thumbKey   = `${baseKey}/thumb.webp`;
  const displayKey = `${baseKey}/display.webp`;
  const fullKey    = `${baseKey}/full.${extFor(full.type)}`;

  // Write the three variants in parallel — independent puts.
  await Promise.all([
    media(ctx).put(thumbKey,   thumb.stream(),   { httpMetadata: { contentType: "image/webp" } }),
    media(ctx).put(displayKey, display.stream(), { httpMetadata: { contentType: "image/webp" } }),
    media(ctx).put(fullKey,    full.stream(),    { httpMetadata: { contentType: full.type } }),
  ]);

  const ts = now();
  await db(ctx)
    .prepare(
      `INSERT INTO photos
         (id, event_id, photographer_id, filename, exif_taken_at, uploaded_at,
          width, height, r2_key_thumb, r2_key_display, r2_key_full, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'live')`,
    )
    .bind(
      photoId,
      event.id,
      photographer.id,
      filename.slice(0, 200),
      intFieldOpt(form, "exif_taken_at"),
      ts,
      intFieldOpt(form, "width"),
      intFieldOpt(form, "height"),
      thumbKey,
      displayKey,
      fullKey,
    )
    .run();

  return Response.json({ id: photoId, thumb_key: thumbKey });
};
