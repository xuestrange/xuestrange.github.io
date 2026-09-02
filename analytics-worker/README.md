# Private visitor analytics

Production endpoint: `https://xuestrange-site-analytics.xuestrange.workers.dev`

This Cloudflare Worker collects privacy-limited visit counts for the Jekyll
site. Its analytics database never stores a raw IP address. The IP is used in
Worker memory to create keyed rate-limit, daily, and monthly HMAC identifiers;
those identifiers rotate or expire automatically.
Daily identifiers are retained for 31 days, monthly identifiers for two months,
and only country plus first-level region are attached to monthly identifiers.

## One-time deployment

1. Sign in to Cloudflare with Wrangler:

   ```bash
   npx wrangler@latest login
   ```

2. Create the D1 database (choose the jurisdiction before creating it if data
   location matters):

   ```bash
   npx wrangler@latest d1 create xuestrange-site-analytics
   ```

3. Replace the all-zero `database_id` in `wrangler.toml` with the returned
   database ID, then initialize it:

   ```bash
   npx wrangler@latest d1 execute xuestrange-site-analytics --remote --file=schema.sql
   ```

4. Create two long random values locally and store them as Worker secrets.
   `HASH_SECRET` anonymizes IP addresses; `ADMIN_TOKEN` unlocks the private
   dashboard. Neither value belongs in Git or `_config.yml`.

   ```bash
   npx wrangler@latest secret put HASH_SECRET
   npx wrangler@latest secret put ADMIN_TOKEN
   ```

5. Deploy:

   ```bash
   npx wrangler@latest deploy
   ```

6. Copy the resulting `https://...workers.dev` URL into `analytics_endpoint`
   in the site's `_config.yml`, rebuild the site, and publish it. The private
   dashboard is then available at `/visitors-8f4c2a71/` and accepts the
   `ADMIN_TOKEN` value as its password.

The public `/collect` endpoint only accepts normal browser requests whose
`Origin` exactly matches `SITE_ORIGIN`. This reduces accidental misuse but is
not a complete anti-abuse control because a determined client can spoof HTTP
headers. `ALLOWED_PATHS` prevents arbitrary database keys; update the list
whenever a new public page is added. A Cloudflare rate-limiting binding also
limits each source IP to ten collection requests per minute. The limit is an
abuse guard rather than an exact counter because Cloudflare enforces it locally
at each edge location. The `/stats` endpoint always requires the secret admin
token.
