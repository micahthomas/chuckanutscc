# Deploying CSCC to Cloudflare

Everything runs on Cloudflare's free tier: Worker for the app, D1 for the database, R2 for media. Plan on **~10–20 minutes** for the first deploy.

## 0. Pre-flight

- A Cloudflare account (sign up at <https://dash.cloudflare.com/sign-up> if you don't have one)
- This repo cloned with `pnpm install` already run
- Local demo working (`pnpm demo` should boot the site at <http://localhost:4321>) so the data you push to production matches what you've been previewing

## 1. Log in to Cloudflare from the CLI

```sh
pnpm wrangler login
```

This pops a browser window and asks you to authorize Wrangler against your account.

## 2. Create the D1 database

```sh
pnpm wrangler d1 create cscc
```

It prints something like:

```jsonc
[[d1_databases]]
binding = "DB"
database_name = "cscc"
database_id = "abc12345-678e-90ff-1234-56789abcdef0"
```

Copy that **`database_id`** value and paste it into `wrangler.jsonc`, replacing the `PLACEHOLDER_RUN_WRANGLER_D1_CREATE` string:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "cscc",
    "database_id": "abc12345-678e-90ff-1234-56789abcdef0",
    "migrations_dir": "./migrations"
  }
],
```

## 3. Create the R2 bucket

```sh
pnpm wrangler r2 bucket create cscc-media
```

(No config to paste — the binding in `wrangler.jsonc` already points at this bucket by name.)

## 4. Apply migrations and seed remote D1

```sh
pnpm db:migrate:remote          # creates all tables
pnpm db:seed:remote             # demo.sql + every seeds/imports/*.sql
```

The second command takes a minute or two — it runs the same seed files your local dev DB uses (events, photos, members, etc.).

## 5. Push images and photos to remote R2

```sh
pnpm media:push:remote
```

This walks your local Miniflare R2 state (in `.wrangler/state/v3/r2/cscc-media/`) and uploads every object to the production bucket. With ~300 photos this takes **5–10 minutes** (one `wrangler` call per file — sequential to avoid rate limits).

## 6. Deploy the Worker

```sh
pnpm deploy
```

Wrangler builds the Astro app, bundles it as a Worker, and ships it. When it finishes you'll get a URL like `https://cscc-website.<your-subdomain>.workers.dev`.

Visit it. The public pages should look exactly like local. Send the URL to the club!

## 7. (Optional but recommended) Lock down `/admin` with Cloudflare Access

Until this step, `/admin` returns `401 Unauthorized` for everyone — the middleware looks for a header that Access populates. To unlock it for officers:

1. In the Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Application domain: `cscc-website.<your-subdomain>.workers.dev` with path `/admin/*`
3. Identity providers: enable Google or email magic links
4. Policy: **Allow** with **Emails ending in** matching your officer addresses, or **Emails** with a hand-picked list

Save. Now `/admin` redirects unauthenticated visitors to log in, and Access injects the `Cf-Access-Authenticated-User-Email` header that the app reads.

Cost: **$0** for up to 50 seats.

## 8. (Optional) Wire a custom domain

In `wrangler.jsonc` add:

```jsonc
"routes": [
  { "pattern": "chuckanutscc.org/*", "custom_domain": true }
]
```

(The domain must be on Cloudflare DNS.) Re-run `pnpm deploy`.

## Re-deploying after changes

Most of the time you just edit code and run:

```sh
pnpm deploy
```

If your changes include a **new migration**: `pnpm db:migrate:remote` before deploy.
If your changes include **new seed content**: `pnpm db:seed:remote` (idempotent — uses `INSERT OR REPLACE`).
If your changes add **new images/photos**: `pnpm media:push:remote` (also idempotent — `put` overwrites existing keys).

## Useful one-liners

| Goal | Command |
| --- | --- |
| Tail production logs | `pnpm wrangler tail cscc-website` |
| Query remote D1 ad-hoc | `pnpm wrangler d1 execute cscc --remote --command "SELECT * FROM events LIMIT 5"` |
| List remote R2 objects | `pnpm wrangler r2 object list cscc-media --remote` |
| Rollback to previous Worker version | Cloudflare dashboard → Workers & Pages → cscc-website → Deployments |

## Troubleshooting

- **`wrangler d1 execute` fails with auth error** — your token expired. Run `pnpm wrangler login` again.
- **`media:push:remote` says "Local R2 state not found"** — you haven't run `pnpm db:seed:local` yet, so there's nothing to mirror. Run that first.
- **Worker deploys but `/admin` returns 401** — that's expected before step 7. Set up Cloudflare Access on `/admin*`.
- **Photos load but show broken images** — confirm `cscc-media` bucket name matches in `wrangler.jsonc`. Also check `pnpm wrangler r2 object list cscc-media --remote` shows your keys.
