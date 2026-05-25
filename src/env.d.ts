/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    admin: { email: string } | null;
  }
}

// Augment the auto-generated Env (from `wrangler types` → worker-configuration.d.ts)
// with our app-specific secrets. These come from `.dev.vars` locally and
// `wrangler secret put` in production. They're optional so dev works without them.
declare namespace Cloudflare {
  interface Env {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    RESEND_API_KEY?: string;
    GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  }
}

interface Env extends Cloudflare.Env {}
