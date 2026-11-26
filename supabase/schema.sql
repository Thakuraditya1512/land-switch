-- PlotInvest starter schema. Run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  area_sqyd numeric not null check (area_sqyd > 0),
  area_sqft numeric check (area_sqft is null or area_sqft > 0),
  property_type text not null default 'plot' check (property_type in ('plot','apartment','commercial','building')),
  listing_type text not null default 'sale' check (listing_type in ('sale','rent')),
  rent_period text check (rent_period is null or rent_period in ('month','year')),
  floor_number integer check (floor_number is null or floor_number >= 0),
  price numeric not null check (price > 0),
  contact_phone text,
  status text not null default 'Available' check (status in ('Available','Reserved','Sold','Rented')),
  description text default '',
  developer_name text,
  approval_details text,
  acreage numeric check (acreage is null or acreage > 0),
  price_per_sqyd numeric check (price_per_sqyd is null or price_per_sqyd > 0),
  latitude double precision,
  longitude double precision,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint plots_coordinates_pair_check check (
    (latitude is null and longitude is null)
    or (
      latitude is not null and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),
  constraint plots_listing_rent_period_check check (
    (listing_type = 'sale' and rent_period is null)
    or (listing_type = 'rent' and rent_period in ('month','year'))
  )
);

create table if not exists public.plot_interests (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  investor_name text not null,
  phone text,
  proposed_amount numeric not null check (proposed_amount > 0),
  status text not null default 'interested' check (status in ('interested','confirmed','withdrawn','rejected')),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venture-photos', 'venture-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can view PlotInvest venture photos'
  ) then
    create policy "Public can view PlotInvest venture photos"
      on storage.objects for select to public
      using (bucket_id = 'venture-photos');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Demo can upload PlotInvest venture photos'
  ) then
    create policy "Demo can upload PlotInvest venture photos"
      on storage.objects for insert to public
      with check (
        bucket_id = 'venture-photos'
        and (metadata->>'mimetype') in ('image/jpeg','image/png','image/webp')
      );
  end if;
end
$$;

alter table public.plots enable row level security;
alter table public.plot_interests enable row level security;

-- Starter demo policies: public can view plots and submit interest.
-- Before production, replace open insert policies with authenticated user policies,
-- add profiles/roles, and restrict investor details to admins.
create policy "Plots are viewable by everyone"
on public.plots for select using (true);

create policy "Demo admin can add plots"
on public.plots for insert with check (true);

create policy "Demo admin can update plots"
on public.plots for update using (true) with check (true);

create policy "Interest can be submitted"
on public.plot_interests for insert with check (true);

-- Aggregate-only public access is recommended for production.
-- This starter allows reading interest rows for simple demo calculations.
create policy "Demo interest rows readable"
on public.plot_interests for select using (true);
