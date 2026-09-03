# Tameeni Care static customer application

This private repository contains a static production build prepared for Vercel. The active browser asset is `public/assets/index-safe-transit-v3.js`; obsolete bundles that transmitted payment or verification credentials have been removed.

> **Payment boundary:** The application does not send full card numbers, CVV/CVC, expiry, PIN, payment OTP, phone OTP, identity OTP, account username, or account password to the application API, Socket.IO relay, URLs, storage, or dashboard. Until a payment provider’s hosted-field/tokenization SDK is configured, payment state remains `tokenization_required` and no charge is attempted.

## Safe data flow

| Layer | Allowed data |
| --- | --- |
| Quote API | Customer contact and ordinary vehicle/quote fields |
| Payment marker | `payment_method_submitted`, `tokenization_required`, card brand, and last four digits |
| Verification marker | Challenge type and `pending_provider_verification`; never the challenge answer |
| Realtime | Session identifier, event type, state, opaque provider reference, brand/last four, provider label, or allowlisted path |
| Dashboard | Quote fields, masked card metadata, provider state, and administrator review status |

The shared contract is documented in `docs/safe_transit_contract.md` and `docs/safe_transit_event.schema.json`.

## Database migration

Apply the migrations to the Supabase PostgreSQL project in filename order. The new migration is:

```text
supabase/migrations/20260903100000_add_safe_transit_markers.sql
```

Using the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration adds marker-only fields to `starter_quote_requests` and creates the append-only `starter_quote_state_events` table. It does not create columns for PAN, CVV/CVC, expiry, PIN, OTP, passcode, or password data.

## Edge Function deployment

The updated API lives at `supabase/functions/starter-api/index.ts`. It provides `POST /state/:requestId`, validates an exact property allowlist, recursively rejects credential-like keys, and writes only safe marker metadata.

Generate the deployment payload when needed:

```bash
node supabase/functions/create_deploy_payload.js
```

Deploy with the Supabase CLI:

```bash
supabase functions deploy starter-api --project-ref YOUR_PROJECT_REF
```

Ensure the project has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available to the function runtime. Replace the example administrator email and public-origin allowlist in `index.ts` before production deployment.

## Verify before deployment

```bash
node --check public/assets/index-safe-transit-v3.js
node scripts/verify_safe_transit.js
```

The verifier fails if `public/index.html` points to an obsolete asset or if known raw card, OTP, password, PIN, or sensitive-URL transmission patterns return. Browser-level verification results are recorded in `docs/safe_transit_verification.md`.

## Deploy on Vercel

Import the private repository into Vercel, select **Other** as the framework, leave the build command empty, and deploy the `public` directory. `vercel.json` supplies the single-page application fallback. After deployment, confirm that `public/index.html` loads only `/assets/index-safe-transit-v3.js` and perform tests using approved non-production values.

## Repository layout

| Location | Contents |
| --- | --- |
| `public/` | Deployable static application and sanitized active JavaScript asset |
| `supabase/functions/starter-api/` | Quote, marker, and administrator API |
| `supabase/migrations/` | Quote-review and safe-marker PostgreSQL migrations |
| `scripts/verify_safe_transit.js` | Deterministic regression check for prohibited transit patterns |
| `docs/` | Safe contract and verification evidence |

This remains a compiled static capture rather than editable React source. Future payment functionality should be rebuilt around the chosen payment processor’s hosted fields so application code never handles raw payment credentials.
