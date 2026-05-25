import type { APIRoute } from "astro";
import { media } from "~/lib/db";

export const GET: APIRoute = async (ctx) => {
  const key = ctx.params.key;
  if (!key) return new Response("Not found", { status: 404 });

  const obj = await media(ctx).get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  // Long cache; image keys include a content hash so they're effectively immutable.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
};
