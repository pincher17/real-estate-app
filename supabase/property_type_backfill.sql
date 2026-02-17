-- One-time backfill for listing property type.
-- Run after adding `property_type` column to public.listings.
-- Rule:
-- 1) explicit apartment keywords -> apartment (highest priority)
-- 2) explicit commercial keywords -> commercial
-- 3) explicit house/land keywords -> house_land
-- 4) everything else stays apartment

update public.listings
set property_type = 'apartment'
where (coalesce(title, '') || ' ' || coalesce(description_raw, '')) ~* '(^|[^a-zа-я])(квартир|апартамент|apartment)([^a-zа-я]|$)';

update public.listings
set property_type = 'commercial'
where property_type = 'apartment'
  and (coalesce(title, '') || ' ' || coalesce(description_raw, '')) !~* '(^|[^a-zа-я])(квартир|апартамент|apartment)([^a-zа-я]|$)'
  and (coalesce(title, '') || ' ' || coalesce(description_raw, '')) ~* '(^|[^a-zа-я])(коммерц|коммерческ|бизнес|офис|магазин|кафе|ресторан|склад|помещен|торгов|commercial|office|shop|retail|warehouse|business)([^a-zа-я]|$)';

update public.listings
set property_type = 'house_land'
where property_type = 'apartment'
  and (coalesce(title, '') || ' ' || coalesce(description_raw, '')) !~* '(^|[^a-zа-я])(квартир|апартамент|apartment)([^a-zа-я]|$)'
  and (coalesce(title, '') || ' ' || coalesce(description_raw, '')) ~* '(^|[^a-zа-я])(участ|земл|коттедж|таунхаус|частный дом|дача|house|land|villa|townhouse|plot)([^a-zа-я]|$)';
