# Safe-transit production rollout

Deploy in the following order so server-side rejection is active before the sanitized browser bundle reaches customers.

| Order | Component | Action | Verification |
| --- | --- | --- | --- |
| 1 | Railway Socket.IO | Deploy `secure-console/server` with exact production CORS origins | `GET /health` reports `transit: "marker-only"`; integration test passes |
| 2 | Supabase PostgreSQL | Apply `20260903100000_add_safe_transit_markers.sql` | Marker columns and `starter_quote_state_events` exist |
| 3 | Supabase Edge Function | Deploy the updated `starter-api` | Safe marker returns 200/201; credential-like key returns 400 |
| 4 | Dashboard | Deploy `secure-console` | `/admin` shows only quote fields, masked metadata, and provider states |
| 5 | Customer site | Deploy `tmin-care-clone/public` | HTML loads only `index-safe-transit-v3.js`; no obsolete JavaScript asset is served |
| 6 | CDN/cache | Purge cached HTML and removed JavaScript assets | Requests for deleted legacy assets return 404 and new sessions load the safe asset |

## Database migration

Using the linked Supabase project:

```bash
cd tmin-care-clone
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, apply the new SQL file through the Supabase SQL editor or a trusted PostgreSQL migration runner. Run it before deploying the updated Edge Function because `/state/:requestId` writes the new columns and event table.

## Edge Function deployment

```bash
cd tmin-care-clone
supabase functions deploy starter-api --project-ref YOUR_PROJECT_REF
```

The function must have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in its server-side environment. Confirm the public-origin allowlist and administrator email before deployment.

## Railway deployment

Set the Railway service root to `secure-console/server`. Configure:

```text
CORS_ORIGIN=https://CUSTOMER_DOMAIN,https://DASHBOARD_DOMAIN
```

Railway provides `PORT`. Use `/health` for the health check. After deployment:

```bash
cd secure-console/server
TEST_SOCKET_URL=https://YOUR_RAILWAY_DOMAIN npm test
```

## Dashboard deployment

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and optionally `VITE_BACKEND_WS_URL` with the Railway relay URL. Build and deploy through the existing Cloudflare/Lovable workflow:

```bash
cd secure-console
npm install
npm run build
```

## Customer deployment

Run the regression checks immediately before deployment:

```bash
cd tmin-care-clone
node --check public/assets/index-safe-transit-v3.js
node scripts/verify_safe_transit.js
```

Deploy the static `public` directory through the existing Vercel project. The deployed HTML must reference only `/assets/index-safe-transit-v3.js`.

## Smoke tests

Use approved non-production values. Inspect the browser network panel and confirm that payment submission sends only `event_type`, `state`, `card_brand`, and `card_last4`; challenge submission sends only `event_type` and `state`; Socket.IO sends only `session:state_changed`; and no request URL includes `otp`, `userOtp`, `cardNumber`, CVV/CVC, PIN, passcode, or password parameters.

Do not roll back to a removed legacy browser asset. If a provider integration is unavailable, leave payment in `tokenization_required` and disable the payment step rather than restoring raw credential transit.
