import type { APIRoute } from "astro";
import { syncAllFolders } from "~/lib/drive";
import { seeOther } from "~/lib/forms";

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });

  const results = await syncAllFolders(ctx);
  const total = results.reduce((sum, r) => sum + r.added, 0);
  const mode = results[0]?.mode ?? "offline";
  const msg = mode === "offline"
    ? `Offline simulator: added ${total} placeholder photos across ${results.length} folder(s).`
    : `Synced ${total} new photo(s) from ${results.length} folder(s).`;

  return seeOther("/admin/photos", msg);
};
