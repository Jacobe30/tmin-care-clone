# Clone Backend Integration Check

**Clone reviewed:** https://tmin-care1.vercel.app/  
**Review time:** 27 August 2026 (GMT+3)  
**Scope:** Non-destructive availability and integration inspection only. No registration, quote, payment, OTP, or identity-verification data was submitted.

## Page count

The deployed client bundle registers **15 client-side routes**. Of those, **2 are stable, directly accessible pages** that are appropriate to describe in the current site map: the home page (`/`) and the registration/details page (`/reg`). The other **13 routes** are transaction, verification, carrier, activation, confirmation, or OTP states that depend on in-progress session data.

| Category | Count | Included routes |
|---|---:|---|
| Stable/direct pages | 2 | `/`, `/reg` |
| Transactional / stateful routes | 13 | `/confirm`, `/verfiy`, `/activate`, `/activate_shamel`, `/phone`, `/phoneOtp`, `/mobilyOtp`, `/stcOtp`, `/motsl`, `/motslOtp`, `/navaz`, `/stc`, `/order_otp` |
| **Total declared client routes** | **15** | Full route set |

## Observable backend configuration

The clone’s JavaScript bundle is configured to send its application requests to **`https://tmn-kse-production.up.railway.app`**, rather than to a Vercel-hosted API. It declares the following submission endpoints and flows:

| Endpoint pattern | Client action | Functional dependency |
|---|---|---|
| `POST /reg` | Starts a registration / quote record | Backend record creation and returned `_id` |
| `POST /apply/:id` | Submits vehicle and coverage details | Valid record ID and quote calculation |
| `POST /company/:id` | Saves chosen insurer/offer | Valid record ID |
| `POST /visa/:id` and `POST /visaOtp/:id` | Payment and payment OTP stages | Payment workflow and real-time acceptance event |
| `POST /phone/:id` and `POST /phoneOtp/:id` | Phone submission and OTP stage | Valid record ID and real-time acceptance event |
| `POST /mobOtp/:id` | Mobily OTP stage | Valid record ID and real-time acceptance event |
| `POST /navaz/:id` | National-identity verification handoff | Valid record ID and third-party verification response |
| `POST /email?type=one&navazOtp=true` | Sends a Navaz/Nafath OTP-related notification | OTP/notification service availability |

The client also initiates a Socket.IO connection to that Railway service and relies on real-time server events such as order binding and acceptance/decline events to move between stages.

## Safe live checks

| Check | Result | Interpretation |
|---|---:|---|
| `GET /` on the configured Railway API | **HTTP 200** | The backend service is reachable. |
| CORS preflight for `POST /reg` from the clone origin | **HTTP 204** | Browser cross-origin submission is permitted. The response allows `POST` and `content-type` and returns `access-control-allow-origin: *`. |
| Socket.IO polling handshake | **HTTP 200** | The real-time transport endpoint is reachable. |

## Conclusion

The clone’s **backend integration is live and reachable**: its API host responds successfully, browser preflight for registration is permitted, and its real-time transport is available. The frontend also has defined client calls for registration, quotation, selection, payment, phone, OTP, and identity-verification stages.

However, these checks cannot establish that the complete business flow is **fully functional end to end**. That requires a controlled test record to perform a valid registration, complete the quote submission, receive a server event, and—if within scope—exercise the external OTP/payment/identity-provider dependencies. Such a test was deliberately not run because it could create records or trigger real verification/payment actions.

## Next recommended test

Use a staging backend or a dedicated approved test account and test data. Validate, in order: `/reg` record creation, `/apply/:id` quote response, `/company/:id` selection persistence, the Socket.IO acceptance event, and the relevant OTP/identity flow. Never use live customer identity, phone, payment, or verification data for this test.
