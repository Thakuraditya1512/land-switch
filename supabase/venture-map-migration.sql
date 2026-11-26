-- Run after schema.sql on an existing PlotInvest Supabase project.
alter table public.plots
  add column if not exists area_sqft numeric check (area_sqft is null or area_sqft > 0),
  add column if not exists property_type text not null default 'plot' check (property_type in ('plot','apartment','commercial','building')),
  add column if not exists floor_number integer check (floor_number is null or floor_number >= 0),
  add column if not exists contact_phone text,
  add column if not exists developer_name text,
  add column if not exists approval_details text,
  add column if not exists acreage numeric check (acreage is null or acreage > 0),
  add column if not exists price_per_sqyd numeric check (price_per_sqyd is null or price_per_sqyd > 0),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists photo_urls text[] not null default '{}';

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

insert into storage.buckets (id, name, public)
values ('venture-photos', 'venture-photos', true)
on conflict (id) do update set public = true;

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
end
$$;
