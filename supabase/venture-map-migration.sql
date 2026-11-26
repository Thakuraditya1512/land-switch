-- Run after schema.sql on an existing PlotInvest Supabase project.
alter table public.plots
  add column if not exists area_sqft numeric check (area_sqft is null or area_sqft > 0),
  add column if not exists property_type text not null default 'plot' check (property_type in ('plot','apartment','commercial','building')),
  add column if not exists listing_type text not null default 'sale' check (listing_type in ('sale','rent')),
  add column if not exists rent_period text check (rent_period is null or rent_period in ('month','year')),
  add column if not exists floor_number integer check (floor_number is null or floor_number >= 0),
  add column if not exists contact_phone text,
  add column if not exists developer_name text,
  add column if not exists approval_details text,
  add column if not exists acreage numeric check (acreage is null or acreage > 0),
  add column if not exists price_per_sqyd numeric check (price_per_sqyd is null or price_per_sqyd > 0),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists photo_urls text[] not null default '{}';

alter table public.plots drop constraint if exists plots_status_check;
alter table public.plots
  add constraint plots_status_check check (status in ('Available','Reserved','Sold','Rented'));

create table if not exists public.plot_interests (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  investor_name text not null,
  phone text,
  proposed_amount numeric not null check (proposed_amount > 0),
  status text not null default 'interested' check (status in ('interested','confirmed','withdrawn','rejected')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plots_coordinates_pair_check'
      and conrelid = 'public.plots'::regclass
  ) then
    alter table public.plots
      add constraint plots_coordinates_pair_check check (
        (latitude is null and longitude is null)
        or (
          latitude is not null and longitude is not null
          and latitude between -90 and 90
          and longitude between -180 and 180
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'plots_listing_rent_period_check'
      and conrelid = 'public.plots'::regclass
  ) then
    alter table public.plots
      add constraint plots_listing_rent_period_check check (
        (listing_type = 'sale' and rent_period is null)
        or (listing_type = 'rent' and rent_period in ('month','year'))
      );
  end if;
end
$$;

alter table public.plots enable row level security;
alter table public.plot_interests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plots'
      and policyname = 'Plots are viewable by everyone'
  ) then
    create policy "Plots are viewable by everyone"
      on public.plots for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plots'
      and policyname = 'Demo admin can add plots'
  ) then
    create policy "Demo admin can add plots"
      on public.plots for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plots'
      and policyname = 'Demo admin can update plots'
  ) then
    create policy "Demo admin can update plots"
      on public.plots for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plot_interests'
      and policyname = 'Interest can be submitted'
  ) then
    create policy "Interest can be submitted"
      on public.plot_interests for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plot_interests'
      and policyname = 'Demo interest rows readable'
  ) then
    create policy "Demo interest rows readable"
      on public.plot_interests for select using (true);
  end if;
end
$$;

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
