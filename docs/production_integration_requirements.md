# Production Integration Requirements

The current Supabase backend is being extended in **test mode**. Its payment and OTP endpoints are designed only to test the application workflow; they do not charge cards, send SMS messages, issue insurance, or contact national-identity systems.

## Test-mode behavior

| Flow | Starter implementation | What it does not do |
|---|---|---|
| Quote selection | Stores a selected test offer. | Does not obtain a binding insurer quotation. |
| Payment | Creates and confirms a simulated payment state without accepting card data. | Does not collect card details, create a charge, or transfer funds. |
| OTP | Creates a short-lived test verification challenge. | Does not send SMS, WhatsApp, email, or voice messages. |
| Identity and policy issuance | Not implemented. | Does not perform national-identity checks or issue insurance. |

## Requirements for real providers

| Capability | Required authorization or credential | Security requirement |
|---|---|---|
| Card or wallet payments | A merchant account, provider-issued API keys, webhook-signing secret, and completed business verification. | Card data must be handled only by the payment provider’s hosted fields or checkout page; never store card numbers or CVV. |
| SMS or WhatsApp OTP | An account with an approved messaging provider, verified sender, and production API credentials. | Rate-limit sends, expire codes quickly, hash codes at rest, and prevent repeated verification attempts. |
| Identity verification | A direct contract/approval with the authorized identity provider. | Obtain explicit user consent, store only necessary data, and follow applicable privacy requirements. |
| Insurance quotes and policy issuance | A commercial agreement and API credentials issued by each insurer or licensed aggregator. | Keep credentials server-side, log only necessary operational information, and ensure regulated review before launch. |

> No production credential should be committed to GitHub or inserted into browser JavaScript. Store authorized provider secrets only in the Supabase project’s secret settings.
