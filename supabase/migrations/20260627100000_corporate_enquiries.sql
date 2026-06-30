create table if not exists public.corporate_enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  company_name  text not null,
  contact_name  text not null,
  email         text not null,
  phone         text,
  employees     int,
  plan          text,
  message       text
);

alter table public.corporate_enquiries enable row level security;
-- only service-role key (edge functions) may read/write
