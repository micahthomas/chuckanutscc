import type { APIRoute } from "astro";
import { db, media, now } from "~/lib/db";
import { newId } from "~/lib/id";
import { assertPhotographerEvent } from "~/lib/photographer-auth";

const MAX_THUMB_BYTES   = 300 * 1024;          //   300 KB
const MAX_DISPLAY_BYTES = 2 * 1024 * 1024;     //   2 MB
const MAX_FULL_BYTES    = 60 * 1024 * 1024;    //  60 MB — large originals welcome

function extFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "image/avif") return "avif";
  return "bin";
}

/** Sniff the first bytes of the file and return a content-type only if the
 * magic bytes match a supported image format. Returning null means the upload
 * is rejected — the file's claimed MIME and extension are not consulted, so a
 * `.jpg` rename trick won't get past this. */
function sniffImageType(head: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return "image/png";
  }
  // RIFF .... WEBP
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return "image/webp";
  }
  // ISO base media (HEIC/HEIF/AVIF): `[size 4B] "ftyp" [brand 4B]`.
  if (
    head.length >= 12 &&
    head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70
  ) {
    const brand = String.fromCharCode(head[8]!, head[9]!, head[10]!, head[11]!);
    // Brands per ISO/IEC 14496-12, MIAF and AVIF (avif/avis/avio).
    if (brand === "avif" || brand === "avis" || brand === "avio") return "image/avif";
    if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx") return "image/heic";
    if (brand === "mif1" || brand === "msf1" || brand === "heim" || brand === "heis" || brand === "heif") return "image/heif";
  }
  return null;
}

function intFieldOpt(form: FormData, name: string): number | null {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hashBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, "0");
  return hex;
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
  // Load the original into memory once — used for sniff, hash, and the R2
  // put. With MAX_FULL_BYTES = 60 MB and Workers' default 128 MB heap, this
  // is comfortably within budget for a single request.
  const fullBuf = await full.arrayBuffer();
  const fullHead = new Uint8Array(fullBuf, 0, Math.min(16, fullBuf.byteLength));

  const fullType = sniffImageType(fullHead);
  if (!fullType) {
    return Response.json(
      { error: `Unsupported original (file=${filename}): content does not match a supported image format.` },
      { status: 400 },
    );
  }

  // Thumb/display are smaller, slicing for sniff is fine.
  const [thumbHead, displayHead] = await Promise.all([
    thumb.slice(0, 16).arrayBuffer().then((b) => new Uint8Array(b)),
    display.slice(0, 16).arrayBuffer().then((b) => new Uint8Array(b)),
  ]);
  if (sniffImageType(thumbHead) !== "image/webp") {
    return Response.json({ error: "Thumb is not a valid WebP" }, { status: 400 });
  }
  if (sniffImageType(displayHead) !== "image/webp") {
    return Response.json({ error: "Display is not a valid WebP" }, { status: 400 });
  }

  // Content-hash dedupe, scoped to (photographer, event). A re-upload of the
  // same bytes returns the existing photo's id instead of storing a copy.
  const contentHash = await sha256Hex(fullBuf);
  const existing = await db(ctx)
    .prepare(
      `SELECT id, r2_key_thumb FROM photos
       WHERE photographer_id = ? AND event_id = ? AND content_hash = ?
       LIMIT 1`,
    )
    .bind(photographer.id, event.id, contentHash)
    .first<{ id: string; r2_key_thumb: string }>();
  if (existing) {
    return Response.json({
      id: existing.id,
      thumb_key: existing.r2_key_thumb,
      deduped: true,
    });
  }

  const photoId = newId();
  const baseKey = `events/${event.id}/${photoId}`;
  const thumbKey   = `${baseKey}/thumb.webp`;
  const displayKey = `${baseKey}/display.webp`;
  const fullKey    = `${baseKey}/full.${extFor(fullType)}`;

  // Write the three variants in parallel — independent puts. The full
  // original goes as the in-memory ArrayBuffer we already hashed, so we
  // don't re-stream the request body.
  await Promise.all([
    media(ctx).put(thumbKey,   thumb.stream(),   { httpMetadata: { contentType: "image/webp" } }),
    media(ctx).put(displayKey, display.stream(), { httpMetadata: { contentType: "image/webp" } }),
    media(ctx).put(fullKey,    fullBuf,          { httpMetadata: { contentType: fullType } }),
  ]);

  const ts = now();
  await db(ctx)
    .prepare(
      `INSERT INTO photos
         (id, event_id, photographer_id, filename, exif_taken_at, uploaded_at,
          width, height, r2_key_thumb, r2_key_display, r2_key_full, sort_order, status, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'live', ?)`,
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
      contentHash,
    )
    .run();

  return Response.json({ id: photoId, thumb_key: thumbKey, deduped: false });
};
