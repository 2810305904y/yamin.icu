create table if not exists public.site_pages (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

revoke all on table public.site_pages from anon, authenticated;
grant select, insert, update on table public.site_pages to service_role;

create or replace function public.set_site_pages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_site_pages_updated_at on public.site_pages;
create trigger set_site_pages_updated_at
before update on public.site_pages
for each row
execute function public.set_site_pages_updated_at();

create table if not exists public.site_page_backups (
  id text primary key,
  page_id text not null,
  reason text not null default 'manual-backup',
  data jsonb not null,
  thought_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists site_page_backups_page_created_idx
on public.site_page_backups (page_id, created_at desc);

alter table public.site_page_backups enable row level security;

revoke all on table public.site_page_backups from anon, authenticated;
grant select, insert on table public.site_page_backups to service_role;
