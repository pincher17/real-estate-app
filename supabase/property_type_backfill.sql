-- apartment
update public.listings
set property_type = 'apartment'
where (coalesce(title,'') || ' ' || coalesce(description_raw,'')) ~* '(^|[^a-zа-я])(квартир[а-яa-z]*|апартамент[а-яa-z]*|apartment[s]?)([^a-zа-я]|$)';

-- commercial
update public.listings
set property_type = 'commercial'
where property_type = 'apartment'
  and (coalesce(title,'') || ' ' || coalesce(description_raw,'')) !~* '(^|[^a-zа-я])(квартир[а-яa-z]*|апартамент[а-яa-z]*|apartment[s]?)([^a-zа-я]|$)'
  and (coalesce(title,'') || ' ' || coalesce(description_raw,'')) ~* '(^|[^a-zа-я])(коммерц[а-яa-z]*|коммерческ[а-яa-z]*|бизнес[а-яa-z]*|офис[а-яa-z]*|магазин[а-яa-z]*|кафе|ресторан[а-яa-z]*|склад[а-яa-z]*|помещен[а-яa-z]*|торгов[а-яa-z]*|commercial|office|shop|retail|warehouse|business)([^a-zа-я]|$)';

-- house_land
update public.listings
set property_type = 'house_land'
where property_type = 'apartment'
  and (coalesce(title,'') || ' ' || coalesce(description_raw,'')) !~* '(^|[^a-zа-я])(квартир[а-яa-z]*|апартамент[а-яa-z]*|apartment[s]?)([^a-zа-я]|$)'
  and (coalesce(title,'') || ' ' || coalesce(description_raw,'')) ~* '(^|[^a-zа-я])(участ[а-яa-z]*|земл[а-яa-z]*|коттедж[а-яa-z]*|таунхаус[а-яa-z]*|частн[а-яa-z]*\s+дом[а-яa-z]*|дач[а-яa-z]*|house|land|villa|townhouse|plot)([^a-zа-я]|$)';
