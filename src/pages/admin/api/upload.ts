import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { newId } from "~/lib/id";

const MAX_BYTES = 6 * 1024 * 1024;             // 6 MB after client-side resize
const ALLOWED_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_CATEGORIES = new Set([
  "venue-map",
  "course-map",
  "event-hero",
  "merch",
  "photographer-headshot",
]);

/**
 * Accepts a single image file (already resized client-side by the
 * ImageUpload component) and writes it to R2.
 *
 * Returns the R2 key so the calling form can stash it in a hidden field.
 * Client-side resize keeps server-side image processing out of the Workers
 * runtime (no sharp available there).
 */
export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });

  const form = await ctx.request.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return Response.json({ error: `Unknown category "${category}"` }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: `Unsupported type ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File too large (${Math.round(file.size / 1024)} KB > ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const key = `uploads/${category}/${newId()}.${ext}`;

  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ key, contentType: file.type, size: file.size });
};
