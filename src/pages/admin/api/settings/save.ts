import type { APIRoute } from "astro";
import { db } from "~/lib/db";
import { str, boolField, seeOther } from "~/lib/forms";

const SETTING_KEYS = [
  "club_name",
  "tagline",
  "contact_email",
  "announcement_text",
  "announcement_link",
  "scorekeeper_series",
  "season_rules_url",
  "register_url",
  "social_instagram_url",
  "social_facebook_url",
] as const;

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.admin) return new Response("Unauthorized", { status: 401 });
  const form = await ctx.request.formData();

  const updates: Array<[string, string]> = [];

  for (const key of SETTING_KEYS) {
    const v = str(form.get(key));
    if (v !== null) updates.push([key, v]);
    else updates.push([key, ""]);
  }
  updates.push(["announcement_enabled", boolField(form, "announcement_enabled") ? "1" : "0"]);

  for (const [key, value] of updates) {
    await db(ctx)
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value)
      .run();
  }

  return seeOther("/admin/settings", "Settings saved.");
};
