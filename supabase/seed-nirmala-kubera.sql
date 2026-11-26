-- Run after schema.sql and venture-map-migration.sql.
-- Removes only the three starter examples, preserving any other user listings.
delete from public.plots
where title in (
  'Green Valley – Phase 2',
  'Lakeview Enclave',
  'Orchid County'
);

update public.plots
set
  location = 'Hyderabad-Warangal Highway, Peerzadiguda / Boduppal, Hyderabad, Telangana',
  area_sqyd = 950::numeric / 9,
  area_sqft = 950,
  property_type = 'apartment',
  floor_number = 4,
  price = 8500000,
  contact_phone = '9398415366',
  status = 'Available',
  description = 'Residential and commercial building along the Hyderabad-Warangal Highway in Peerzadiguda / Boduppal, Hyderabad. This listing is for one 4th-floor flat measuring 950 sq ft, offered at Rs 85 lakh.',
  latitude = 17.40242916870953,
  longitude = 78.58220801617115
where title = 'Nirmala Kubera Heights';

insert into public.plots (
  title,
  location,
  area_sqyd,
  area_sqft,
  property_type,
  floor_number,
  price,
  contact_phone,
  status,
  description,
  latitude,
  longitude
)
select
  'Nirmala Kubera Heights',
  'Hyderabad-Warangal Highway, Peerzadiguda / Boduppal, Hyderabad, Telangana',
  950::numeric / 9,
  950,
  'apartment',
  4,
  8500000,
  '9398415366',
  'Available',
  'Residential and commercial building along the Hyderabad-Warangal Highway in Peerzadiguda / Boduppal, Hyderabad. This listing is for one 4th-floor flat measuring 950 sq ft, offered at Rs 85 lakh.',
  17.40242916870953,
  78.58220801617115
where not exists (
  select 1 from public.plots where title = 'Nirmala Kubera Heights'
);
