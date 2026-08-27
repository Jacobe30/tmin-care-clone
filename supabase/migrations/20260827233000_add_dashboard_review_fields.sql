alter table public.starter_quote_requests
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists last_page text,
  add column if not exists last_activity_at timestamptz;

create table if not exists public.starter_quote_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.starter_quote_requests(id) on delete cascade,
  page_path text not null check (page_path like '/%'),
  occurred_at timestamptz not null default now()
);

create index if not exists starter_quote_activity_request_time_idx
  on public.starter_quote_activity (request_id, occurred_at desc);

alter table public.starter_quote_activity enable row level security;

comment on column public.starter_quote_requests.customer_name is
  'Customer contact name for authorized manual quote review.';
comment on column public.starter_quote_requests.customer_phone is
  'Customer contact phone for authorized manual quote review.';
comment on column public.starter_quote_requests.last_page is
  'Last declared site path for consent-aware journey tracking.';
comment on table public.starter_quote_activity is
  'Consent-aware page-path activity log. Excludes payment, OTP, and government identity data.';
