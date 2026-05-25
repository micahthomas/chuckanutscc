import type { APIRoute } from "astro";
import { recordMembershipPayment } from "~/lib/mutations";

/**
 * Offline-only Stripe Checkout substitute. Used when STRIPE_SECRET_KEY isn't
 * configured. Renders a tiny page with the payment details and a "Pay" button
 * that POSTs back here to simulate a successful payment.
 *
 * Applicant fields (address, family member, etc.) ride along as `extra_*`
 * query params so the POST handler can store them on the member row.
 */
export const GET: APIRoute = ({ url }) => {
  const p = url.searchParams;
  const tier = p.get("tier_name") ?? "Membership";
  const amount = Number(p.get("amount_cents") ?? "0");
  const year = p.get("year") ?? "";
  const email = p.get("email") ?? "";
  const name = p.get("name") ?? "";
  const dollars = (amount / 100).toFixed(2);

  const hidden = Array.from(p.entries())
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}"/>`)
    .join("");

  // Tiny applicant summary so the mock checkout shows what's about to be saved.
  const extras: Array<[string, string]> = [];
  for (const [k, v] of p.entries()) {
    if (k.startsWith("extra_") && v) {
      const label = k.replace(/^extra_/, "").replace(/_/g, " ");
      extras.push([label, v]);
    }
  }
  const extraRows = extras.map(([k, v]) =>
    `<div><strong style="text-transform:capitalize">${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`,
  ).join("");

  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:1rem">
       <form method="post" action="/api/membership/mock-checkout" style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:2rem;max-width:30rem;width:100%">
         <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;margin-bottom:0.5rem">Offline mock checkout</div>
         <h1 style="margin:0 0 1rem 0;font-size:1.5rem">${escapeHtml(tier)} — ${escapeHtml(year)}</h1>
         <dl style="font-size:0.875rem;color:#475569;margin-bottom:1.5rem;display:grid;gap:0.25rem">
           <div><strong>Name:</strong> ${escapeHtml(name)}</div>
           <div><strong>Email:</strong> ${escapeHtml(email)}</div>
           ${extraRows}
           <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #e2e8f0"><strong>Amount:</strong> $${dollars}</div>
         </dl>
         ${hidden}
         <button type="submit" style="background:#1d3a6b;color:white;border:0;border-radius:6px;padding:0.75rem 1.25rem;font-weight:500;cursor:pointer;width:100%">
           Pay $${dollars} (simulate)
         </button>
         <p style="font-size:0.75rem;color:#94a3b8;margin-top:1rem">
           Stripe is not configured locally. This button will record a payment
           as if the real flow completed.
         </p>
       </form>
     </body></html>`,
    { headers: { "content-type": "text/html" } },
  );
};

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const tierId = form.get("tier_id");
  const amount = Number(form.get("amount_cents"));
  const year = Number(form.get("year"));
  const email = form.get("email");
  const name = form.get("name");
  const successUrl = form.get("success_url");

  if (typeof tierId !== "string" || typeof email !== "string" || typeof name !== "string") {
    return new Response("Invalid mock checkout", { status: 400 });
  }

  const extra = (k: string): string | null => {
    const v = form.get(`extra_${k}`);
    return typeof v === "string" && v !== "" ? v : null;
  };

  const session = await recordMembershipPayment(ctx, {
    memberEmail: email,
    memberName: name,
    tierId,
    amountCents: amount,
    membershipYear: year,
    stripeCheckoutSessionId: `mock_${crypto.randomUUID()}`,
    phone: extra("phone"),
    addressLine1: extra("address_line1"),
    addressLine2: extra("address_line2"),
    city: extra("city"),
    state: extra("state"),
    postalCode: extra("postal_code"),
    carInfo: extra("car_info"),
    familyMemberName: extra("family_member_name"),
  });

  const dest =
    typeof successUrl === "string"
      ? successUrl.replace("{CHECKOUT_SESSION_ID}", `mock_${session.memberId}`)
      : `/membership/thanks?session_id=mock_${session.memberId}`;
  return Response.redirect(new URL(dest, ctx.url).toString(), 303);
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c] ?? c);
}
