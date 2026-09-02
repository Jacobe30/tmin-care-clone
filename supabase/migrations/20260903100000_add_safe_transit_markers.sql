alter table public.starter_quote_requests
  add column if not exists payment_state text,
  add column if not exists payment_card_brand text,
  add column if not exists payment_card_last4 text,
  add column if not exists payment_reference text,
  add column if not exists verification_state text,
  add column if not exists last_event_type text;

create table if not exists public.starter_quote_state_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.starter_quote_requests(id) on delete cascade,
  event_type text not null,
  state text not null,
  card_brand text,
  card_last4 text,
  provider_reference text,
  provider text,
  occurred_at timestamptz not null default now(),
  constraint starter_quote_state_events_event_type_check check (
    event_type in (
      'payment_method_submitted',
      'payment_challenge_submitted',
      'phone_challenge_submitted',
      'identity_verification_started',
      'identity_challenge_submitted',
      'contact_method_selected',
      'page_viewed'
    )
  ),
  constraint starter_quote_state_events_state_check check (
    state in (
      'submitted',
      'tokenization_required',
      'tokenized',
      'pending_provider_verification',
      'verified',
      'failed',
      'observed'
    )
  ),
  constraint starter_quote_state_events_card_brand_check check (
    card_brand is null or card_brand in ('visa', 'mastercard', 'mada', 'amex', 'unknown')
  ),
  constraint starter_quote_state_events_card_last4_check check (
    card_last4 is null or card_last4 ~ '^[0-9]{4}$'
  ),
  constraint starter_quote_state_events_reference_check check (
    provider_reference is null or provider_reference ~ '^[A-Za-z0-9._:-]{1,160}$'
  ),
  constraint starter_quote_state_events_provider_check check (
    provider is null or char_length(provider) between 1 and 80
  )
);

create index if not exists starter_quote_state_events_request_time_idx
  on public.starter_quote_state_events (request_id, occurred_at desc);

alter table public.starter_quote_state_events enable row level security;

comment on column public.starter_quote_requests.payment_state is
  'Non-sensitive payment state marker. Never stores PAN, CVV, PIN, expiry, or challenge answers.';
comment on column public.starter_quote_requests.payment_card_brand is
  'Allowlisted payment brand supplied by a tokenization flow.';
comment on column public.starter_quote_requests.payment_card_last4 is
  'Last four digits only. Full payment card numbers are prohibited.';
comment on column public.starter_quote_requests.payment_reference is
  'Opaque provider-issued payment reference; never a payment credential.';
comment on column public.starter_quote_requests.verification_state is
  'Non-sensitive provider-verification state. OTP and passcode values are prohibited.';
comment on table public.starter_quote_state_events is
  'Append-only marker events containing no card numbers, CVV/CVC, OTPs, PINs, passwords, or identity credentials.';
