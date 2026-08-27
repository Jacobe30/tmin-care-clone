create table if not exists public.starter_quote_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  insurance_type text,
  vehicle_year integer check (vehicle_year is null or vehicle_year between 1990 and 2030),
  vehicle_make_model text,
  vehicle_value numeric(12,2) check (vehicle_value is null or vehicle_value >= 0),
  usage_purpose text,
  policy_start_date date,
  repair_location text,
  selected_offer jsonb,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists starter_quote_requests_status_created_at_idx
  on public.starter_quote_requests (status, created_at desc);

alter table public.starter_quote_requests enable row level security;

comment on table public.starter_quote_requests is
  'Test-only manual-review queue. It deliberately excludes identity, phone, payment, OTP, and national verification data.';
