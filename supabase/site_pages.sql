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

