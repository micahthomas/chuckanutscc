import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { recordMembershipPayment } from "~/lib/mutations";

/**
 * Stripe webhook for successful Checkout payments. Only relevant when
 * STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are configured.
 *
 * In offline mode the mock-checkout route records payments directly, so this
 * endpoint isn't called.
 */
export const POST: APIRoute = async (ctx) => {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const sig = ctx.request.headers.get("stripe-signature");
  const body = await ctx.request.text();
  if (!sig) return new Response("Missing signature", { status: 400 });

  if (!(await verifyStripeSignature(body, sig, webhookSecret))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body) as { type: string; data: { object: StripeSession } };

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object;
  const tierId = session.metadata?.tier_id;
  const yearStr = session.metadata?.membership_year;
  const memberName = session.metadata?.member_name ?? session.customer_details?.name ?? "Unknown";
  const memberEmail = session.customer_email ?? session.customer_details?.email;

  if (!tierId || !yearStr || !memberEmail) {
    return new Response("Missing metadata", { status: 400 });
  }

  await recordMembershipPayment(ctx, {
    memberEmail,
    memberName,
    tierId,
    amountCents: session.amount_total ?? 0,
    membershipYear: Number(yearStr),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: session.payment_intent ?? null,
    rawStripeEventJson: body,
  });

  return new Response("ok", { status: 200 });
};

interface StripeSession {
  id: string;
  amount_total: number | null;
  customer_email: string | null;
  customer_details?: { name?: string; email?: string };
  payment_intent: string | null;
  metadata?: { tier_id?: string; membership_year?: string; member_name?: string };
}

/**
 * Stripe webhook signature verification using Web Crypto (works in Workers).
 * Format: `t=<ts>,v1=<hex>` — we hash `<ts>.<body>` with the secret.
 */
async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const ts = parts.t;
  const expected = parts.v1;
  if (!ts || !expected) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${body}`));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(sigHex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
