# Safe transit contract

The customer application must never place payment-card numbers, CVV/CVC values, payment or identity OTPs, PINs, account passwords, or verification credentials into HTTP, WebSocket, beacon, URL-query, local-storage, or database payloads. Card collection must ultimately use hosted fields or an SDK supplied by the payment processor; this repository exposes only a marker fallback until a real processor token is configured.

| Event type | Allowed state | Optional safe metadata | Prohibited content |
| --- | --- | --- | --- |
| `payment_method_submitted` | `tokenization_required`, `tokenized` | `cardBrand`, `cardLast4`, `providerReference` | PAN, CVV/CVC, expiry, cardholder credentials, PIN |
| `payment_challenge_submitted` | `pending_provider_verification`, `verified`, `failed` | `providerReference` | OTP/passcode or challenge answer |
| `phone_challenge_submitted` | `pending_provider_verification`, `verified`, `failed` | Provider/network label | OTP/passcode |
| `identity_verification_started` | `pending_provider_verification`, `verified`, `failed` | `providerReference` | Username, password, national verification code, OTP |
| `contact_method_selected` | `submitted` | Provider/network label | Phone OTP or account credentials |
| `page_viewed` | `observed` | Allowlisted page path | Query strings or form values |

The browser sends state markers to `POST /state/:requestId`. Realtime messages use the same semantic fields and may contain only `sessionId`, `eventType`, `state`, `referenceId`, `cardBrand`, `cardLast4`, and a bounded page path. The Railway relay rejects any message containing prohibited keys or unmasked card/OTP-like values before broadcasting it.

The database stores only `payment_state`, `payment_card_brand`, `payment_card_last4`, `payment_reference`, `verification_state`, and `last_event_type`. Administrator interfaces render `•••• 1234` when the last four digits are available and otherwise display the state marker. They never derive a mask from a raw card number received over the network.
