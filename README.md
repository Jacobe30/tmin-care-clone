# Tameeni Care Clone

This private repository contains a **static capture of the currently deployed clone** at `https://tmin-care1.vercel.app/`. It is ready to redeploy as a Vercel single-page application.

## Backend connection

The captured production client is configured to use the following backend service:

```text
https://tmn-kse-production.up.railway.app
```

The API base URL is embedded in the captured browser bundle at:

```text
public/assets/index-Hq9PQyPZ.js
```

The reachable client submission flows include registration, quote application, insurer selection, payment/OTP, phone/OTP, and identity-verification steps. The backend and real-time Socket.IO service were reachable during the non-destructive check on 27 August 2026.

> Do not place customer identity, phone, payment, OTP, or verification data in GitHub, URLs intended for sharing, browser logs, or test fixtures.

## Repository layout

| Location | Contents |
|---|---|
| `public/` | The captured deployable front end, including the HTML entry point, bundled JavaScript/CSS, and referenced images. |
| `vercel.json` | Single-page application fallback routing for the clone’s customer-journey URLs. |
| `public/sitemap.xml` | Search sitemap for the home page and registration page. |
| `public/robots.txt` | Crawler rule that points crawlers to the deployed sitemap. |
| `docs/` | Asset inventory and capture notes. |

## Deploy on Vercel

1. In Vercel, select **Add New → Project**.
2. Import the private GitHub repository **`Jacobe30/tmin-care-clone`**.
3. Keep the framework preset as **Other** and do not set a build command.
4. Deploy. Vercel will serve the `public` directory and use `vercel.json` for the application routes.
5. Open the deployed site and run a controlled test only with approved test data.

## Important limitation

This is a **static production capture**, not the original React source project. It preserves the currently deployed appearance and API behavior, but the application’s JavaScript is compiled/minified. For maintainable feature changes, the next step is to rebuild the front end as an editable React project while retaining the API contract above.
