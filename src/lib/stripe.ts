import type { APIContext } from "astro";
import { env } from "cloudflare:workers";

export interface CheckoutInput {
  /** Membership tier id (membership_tiers.id). */
  tierId: string;
  tierName: string;
  amountCents: number;
  membershipYear: number;
  memberEmail: string;
  memberName: string;
  successUrl: string;
  cancelUrl: string;
  /**
   * Extra applicant fields (address, phone, family member, etc.) — round-tripped
   * through the offline mock as query params or attached to Stripe metadata in
   * live mode so `recordMembershipPayment` can persist them on the member row.
   */
  extra?: Record<string, string | null | undefined>;
}

export interface CheckoutResult {
  url: string;
  mode: "live" | "offline";
  sessionId: string;
}

/**
 * Creates a Stripe Checkout session for a membership payment.
 *
 * If STRIPE_SECRET_KEY is not set (offline / local dev), returns a URL to a
 * built-in mock-checkout page that simulates the same return flow without
 * involving Stripe. This lets the demo run end-to-end without an account.
 */
export async function createMembershipCheckout(
  _ctx: APIContext,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const key = env.STRIPE_SECRET_KEY;

  if (!key) {
    // Offline mock: stash the payment details in the URL so the mock page can
    // render a "Pay $X" button that POSTs the same data the real webhook would
    // deliver. URL-encoded JSON is ugly but keeps the mock entirely stateless.
    const params = new URLSearchParams({
      tier_id: input.tierId,
      tier_name: input.tierName,
      amount_cents: String(input.amountCents),
      year: String(input.membershipYear),
      email: input.memberEmail,
      name: input.memberName,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (input.extra) {
      for (const [k, v] of Object.entries(input.extra)) {
        if (v != null && v !== "") params.set(`extra_${k}`, v);
      }
    }
    return {
      url: `/api/membership/mock-checkout?${params.toString()}`,
      mode: "offline",
      sessionId: `mock_${crypto.randomUUID()}`,
    };
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("customer_email", input.memberEmail);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  body.set("line_items[0][price_data][product_data][name]",
    `${input.tierName} membership — ${input.membershipYear}`);
  body.set("metadata[tier_id]", input.tierId);
  body.set("metadata[membership_year]", String(input.membershipYear));
  body.set("metadata[member_name]", input.memberName);
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      if (v != null && v !== "") body.set(`metadata[${k}]`, v);
    }
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Stripe checkout creation failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return { url: json.url, mode: "live", sessionId: json.id };
}
