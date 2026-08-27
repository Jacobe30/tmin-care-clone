# Supabase Pending-Review Queue

The Vercel form now submits test requests to the `starter_quote_requests` table in the Supabase project **tmin-care-starter-api**. Every request is created with a `pending` status.

## Review and accept a request

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and select **tmin-care-starter-api**.
2. Go to **Table Editor** and open `starter_quote_requests` in the `public` schema.
3. Sort by `created_at` so new requests appear first.
4. Open a pending row. Change `status` to `accepted` or `declined`.
5. Optionally fill `review_note` and set `reviewed_at` to the current time. Save the row.

> Requests are deliberately test-only. The table does not store national IDs, telephone numbers, card details, OTPs, or identity-verification information.

## Data fields available to review

| Field | Description |
|---|---|
| `status` | `pending`, `accepted`, or `declined`. |
| `insurance_type` | The requested insurance type. |
| `vehicle_year` | Vehicle model year, if supplied. |
| `vehicle_make_model` | Vehicle make/model, if later supplied in the form. |
| `vehicle_value` | Declared vehicle value, if later supplied. |
| `usage_purpose` | Declared vehicle use, if later supplied. |
| `policy_start_date` | Requested start date, if later supplied. |
| `repair_location` | Repair location preference, if later supplied. |
| `review_note` | Optional owner note for the decision. |
| `created_at`, `reviewed_at` | Creation and review timestamps. |
