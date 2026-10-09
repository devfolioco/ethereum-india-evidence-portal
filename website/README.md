# ETHIndia Institutional website

Run `npm ci`, then `npm run dev`. `npm run build` produces the static pages and
the Vercel backend function. `npm test` checks the signup endpoint without
contacting Cloudflare or writing to a live database.

Run `npm run test:deployment` to build and test the packaged Vercel function in
an isolated temporary directory. This checks startup and endpoint responses
without relying on dependencies installed in the build workspace. D1 writes
are mocked in this check.

The Astro config contains a narrow workaround for `@astrojs/vercel` 11.0.13:
its server entry imports constants through the adapter's build entry, retaining
an unused Rolldown import. Tree-shaking that import prevents native build bindings
from being required at function startup. Other module side effects are preserved.

The `@vercel/routing-utils` dependency pins a vulnerable `path-to-regexp` release,
so `package.json` overrides it with the compatible patched 6.3.0 version.
The lockfile also updates `http-cache-semantics` to 4.3.0. CI runs
`npm audit --audit-level=high` to flag newly reported high/critical advisories.

## Show interest

The homepage form posts to `/api/interest`. The Astro endpoint runs as a Vercel
Function and writes to Cloudflare D1 through its authenticated REST API.
All other pages remain prerendered. Vercel uses the adapter's `.vercel/output`
build output; do not override the output directory with the old static `dist`.

The `interest_signups` table stores only a normalized email and its first signup
timestamp. Duplicate submissions succeed without adding a row or changing that
timestamp. This collects interest; it does not send email or verify ownership of
the submitted address.

### Database

The production database `ethindia-institutional-interest` is in the Devfolio
Cloudflare account, with its primary location in APAC. `wrangler.jsonc` records
the account and database IDs for administration; it does not deploy a Worker.

- Account ID: `57d45ef71c5fa2dafd245cd551b60ded`
- Database ID: `5e9240ce-e404-4273-835c-80411da76739`

To provision a separate database in another environment:

After signing in to Cloudflare with `wrangler login`, run these from `website/`:

```sh
wrangler d1 create <database-name>
```

Update the relevant Wrangler configuration with the returned database UUID.
Apply the schema to the configured database with:

```sh
wrangler d1 execute DB --remote --file=db/0001_interest_signups.sql
```

The schema can also be run in the database's Cloudflare dashboard console. It is
safe to apply more than once.

### Configure the backend

Create a Cloudflare API token with **Account → D1 → Edit**, scoped to the account
containing this database. Add these server-only variables under the Vercel
project's Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 database UUID |
| `CLOUDFLARE_API_TOKEN` | The D1 API token |

Configure Production and, if wanted, Preview. Use a separate database for Preview
to keep test submissions out of the production signup list. Redeploy after adding
or changing variables. The existing GitHub Actions deployment continues to work;
the function reads credentials from Vercel, so no Cloudflare secrets are needed
in GitHub Actions.

For local testing, copy `.env.example` to `.env` and fill in the same variables
using a development database. `.env` is ignored by Git. Without configuration,
the endpoint returns a retryable error and the form keeps the entered email.

### Verification and behavior

- Submit an address from the homepage and check the D1 console for one row.
- Submit it again with different capitalization; there should still be one row.
- JSON clients use `Accept: application/json`; native form submissions receive
  an HTML confirmation or error, so JavaScript is optional.
- The endpoint validates email, limits request size, rejects cross-origin browser
  posts, uses bound SQL parameters, and times out failed D1 requests.
- A hidden honeypot catches basic form bots. It is not a rate limiter or email
  verification. Rate limiting is intentionally not enabled. Automated clients
  can bypass the honeypot and origin checks, so repeated submissions can consume
  Vercel requests and D1 writes. The endpoint does not verify email ownership.
- Emails and tokens are not logged or exposed by a public read endpoint.

For a 503, inspect the Vercel function log entry prefixed `[interest]`. It reports
missing variable names, Cloudflare HTTP status and numeric error codes, a missing
table, or a request timeout/failure. It never logs submitted emails, credentials,
SQL, or raw upstream error messages. Check Preview-scoped variables and redeploy
after changes when testing a preview URL.

References: [Astro Vercel adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/),
[Cloudflare D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
