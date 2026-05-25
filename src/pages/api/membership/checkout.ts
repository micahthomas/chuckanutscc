import type { APIRoute } from "astro";
import { required, str, badRequest } from "~/lib/forms";
import { loadMembershipTier } from "~/lib/queries";
import { createMembershipCheckout } from "~/lib/stripe";

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const tierId = required(form, "tier_id");
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

  const tier = await loadMembershipTier(ctx, tierId);
  if (!tier) return badRequest("Membership tier not found");

  const year = new Date().getUTCFullYear();
  const origin = ctx.url.origin;

  const session = await createMembershipCheckout(ctx, {
    tierId: tier.id,
    tierName: tier.name,
    amountCents: tier.annual_price_cents,
    membershipYear: year,
    memberEmail: email,
    memberName: name,
    successUrl: `${origin}/membership/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/membership`,
    extra: {
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city,
      state,
      postal_code: postalCode,
      car_info: carInfo,
      family_member_name: familyMemberName,
    },
  });

  return Response.redirect(new URL(session.url, ctx.url).toString(), 303);
};
