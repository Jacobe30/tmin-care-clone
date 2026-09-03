# Safe transit verification

The active local customer build loaded `index-safe-transit-v3.js` successfully. Browser-level sanitizer checks confirmed that raw card, CVV, OTP, PIN, password, and nested credential keys were removed. The realtime mapper emitted only `sessionId`, `eventType`, and `state`; the payment request mapper emitted only `event_type`, `state`, `card_brand`, and `card_last4`; and URL sanitization removed `userOtp` plus sensitive fields embedded in the JSON `data` parameter.

| Check | Result |
| --- | --- |
| Recursive payload stripping | Passed |
| Marker-only realtime mapping | Passed |
| Card request remapping to `/state/:id` | Passed |
| Last-four and brand-only card metadata | Passed |
| Sensitive URL query removal | Passed |
| Customer site rendering | Passed |

The rendered `/confirm` route was inspected in a browser. Card-number and CVV inputs were marked with `data-safe-masked="true"`, had autocomplete disabled, and used `-webkit-text-security: disc`. The route contained only non-sensitive quote metadata.
The live payment form accepted non-production test input while rendering the card number and CVV as masked dots. A local XHR capture stub was installed before submission so the next payload inspection cannot reach any external service.

A real form submission was executed against the local XHR capture stub. The intercepted request was `POST /state/00000000-0000-4000-8000-000000000001` with exactly `{ "event_type": "payment_method_submitted", "state": "tokenization_required", "card_brand": "visa", "card_last4": "0366" }`. The captured request contained no PAN, CVV/CVC, expiry, PIN, cardholder name, OTP, or password.
The rebuilt `/verfiy` route rendered the card as `************0366` from `cardBrand` and `cardLast4` only. Its challenge input had autocomplete disabled and `-webkit-text-security: disc`; the URL contained neither `cardNumber` nor `otp`/`userOtp` parameters.

All three PostgreSQL migrations were applied in order to a disposable PostgreSQL 16 database. The resulting schema contained `starter_quote_requests`, `starter_quote_activity`, and `starter_quote_state_events`, with all six marker columns present on the request table.

The hardened Railway relay passed an end-to-end Socket.IO integration test. One valid payment marker reached the monitoring room; payloads containing a raw-card key, an OTP key, an unknown nested metadata object, and a credential-bearing redirect were rejected and were not broadcast. Runtime logs contained only session identifier, event type, and state.
