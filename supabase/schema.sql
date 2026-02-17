-- Real Estate Aggregator - Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ENUMS
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_condition') then
    create type listing_condition as enum (
      'WHITE_FRAME',
      'BLACK_FRAME',
      'RENOVATED',
      'OLD_RENOVATION',
      'NEW_RENOVATION',
      'UNDER_CONSTRUCTION',
      'FURNISHED',
      'SHELL',
      'OTHER'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_property_type') then
    create type listing_property_type as enum (
      'apartment',
      'house_land',
      'commercial'
    );
  end if;
end
$$;

-- TABLE: sources
-- Stores Telegram channels and other data sources
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'telegram_channel'
  telegram_peer_id bigint not null,
  title text,
  username text,
  last_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sources_telegram_peer_id_ux
  on public.sources (telegram_peer_id);

create unique index if not exists sources_username_ux
  on public.sources (username)
  where username is not null;

create index if not exists sources_type_idx
  on public.sources (type);

-- TABLE: telegram_messages
-- Raw Telegram messages (immutable)
create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  message_id bigint not null,
  grouped_id bigint,
  posted_at timestamptz not null,
  text_raw text,
  permalink text,
  has_media boolean not null default false,
  media_count integer not null default 0,
  json_raw jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists telegram_messages_source_message_ux
  on public.telegram_messages (source_id, message_id);

create index if not exists telegram_messages_source_posted_idx
  on public.telegram_messages (source_id, posted_at desc);

-- TABLE: telegram_media
-- Media files from Telegram messages
create table if not exists public.telegram_media (
  id uuid primary key default gen_random_uuid(),
  message_row_id uuid not null references public.telegram_messages(id) on delete cascade,
  telegram_file_id text,
  type text not null, -- 'photo'
  width integer,
  height integer,
  storage_bucket text,
  storage_path text,
  cdn_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists telegram_media_message_idx
  on public.telegram_media (message_row_id, position);

-- TABLE: listings
-- Structured listing data extracted from Telegram posts
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  message_id bigint not null,
  listing_key bigint not null,
  posted_at timestamptz not null,
  title text,
  description_raw text,
  property_type listing_property_type not null default 'apartment',
  permalink text,

  -- Price fields
  price_value numeric,
  price_currency text,
  price_usd numeric,

  -- Area fields
  area_m2 numeric,
  floor integer,
  total_floors integer,

  -- Room fields
  rooms_text text,
  rooms_bedrooms integer,
  rooms_living integer,

  -- Condition fields
  condition_raw text,
  condition_norm listing_condition,

  -- Maintenance fee fields
  maintenance_fee_value numeric,
  maintenance_fee_currency text,

  -- Address fields
  district text,
  street text,
  building_name text,
  address_text text,
  lat numeric,
  lng numeric,

  -- Extraction metadata
  extract_version text,
  extract_confidence numeric,
  extract_warnings text[],
  needs_review boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listings
  add column if not exists property_type listing_property_type not null default 'apartment';

create unique index if not exists listings_source_listing_key_ux
  on public.listings (source_id, listing_key);

create index if not exists listings_posted_idx
  on public.listings (posted_at desc);

create index if not exists listings_price_usd_idx
  on public.listings (price_usd)
  where price_usd is not null;

create index if not exists listings_area_m2_idx
  on public.listings (area_m2)
  where area_m2 is not null;

create index if not exists listings_floor_idx
  on public.listings (floor)
  where floor is not null;

create index if not exists listings_rooms_bedrooms_idx
  on public.listings (rooms_bedrooms)
  where rooms_bedrooms is not null;

create index if not exists listings_condition_norm_idx
  on public.listings (condition_norm)
  where condition_norm is not null;

create index if not exists listings_property_type_idx
  on public.listings (property_type);

create index if not exists listings_district_idx
  on public.listings (district)
  where district is not null;

create index if not exists listings_building_name_idx
  on public.listings (building_name)
  where building_name is not null;

-- Full-text search index for building names and streets
create index if not exists listings_building_name_trgm_idx
  on public.listings using gin (building_name gin_trgm_ops)
  where building_name is not null;

create index if not exists listings_street_trgm_idx
  on public.listings using gin (street gin_trgm_ops)
  where street is not null;

-- TABLE: listing_images
-- Images linked to listings (for easy querying)
create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  telegram_media_id uuid references public.telegram_media(id) on delete set null,
  url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listing_images_listing_idx
  on public.listing_images (listing_id, position);

create unique index if not exists listing_images_listing_position_ux
  on public.listing_images (listing_id, position);

-- TABLE: admin_users
-- Admin access list for protected API actions
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_users_is_admin_idx
  on public.admin_users (is_admin);

-- TABLE: excluded_listings
-- Listings manually or automatically excluded from re-import
create table if not exists public.excluded_listings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  listing_key bigint not null,
  message_id bigint,
  permalink text,
  reason text,
  deleted_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists excluded_listings_source_listing_key_ux
  on public.excluded_listings (source_id, listing_key);

create index if not exists excluded_listings_source_idx
  on public.excluded_listings (source_id, created_at desc);

-- TABLE: extraction_runs
-- Track AI extraction runs for debugging and monitoring
create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  input_text_hash text,
  output_json jsonb,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  status text not null, -- 'SUCCESS' | 'FAILED'
  error text,
  created_at timestamptz not null default now()
);

create index if not exists extraction_runs_listing_idx
  on public.extraction_runs (listing_id, created_at desc);

create index if not exists extraction_runs_status_idx
  on public.extraction_runs (status);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Auto-classify property_type by title/description for new rows only.
-- Manual updates in admin must keep selected property_type.
-- Priority:
-- 1) apartment keywords
-- 2) commercial keywords
-- 3) house/land keywords
-- 4) fallback apartment
create or replace function set_listing_property_type_by_text()
returns trigger as $$
declare
  txt text;
begin
  txt := coalesce(new.title, '') || ' ' || coalesce(new.description_raw, '');

  if txt ~* '(^|[^a-zа-я])(квартир|апартамент|apartment)([^a-zа-я]|$)' then
    new.property_type := 'apartment';
  elsif txt ~* '(^|[^a-zа-я])(коммерц|коммерческ|бизнес|офис|магазин|кафе|ресторан|склад|помещен|торгов|commercial|office|shop|retail|warehouse|business)([^a-zа-я]|$)' then
    new.property_type := 'commercial';
  elsif txt ~* '(^|[^a-zа-я])(участ|земл|коттедж|таунхаус|частный дом|дача|house|land|villa|townhouse|plot)([^a-zа-я]|$)' then
    new.property_type := 'house_land';
  elsif new.property_type is null then
    new.property_type := 'apartment';
  end if;

  return new;
end;
$$ language plpgsql;

-- Trigger for sources table
drop trigger if exists update_sources_updated_at on public.sources;
create trigger update_sources_updated_at
  before update on public.sources
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_admin_users_updated_at on public.admin_users;
create trigger update_admin_users_updated_at
  before update on public.admin_users
  for each row
  execute function update_updated_at_column();

-- Trigger for listings table
drop trigger if exists update_listings_updated_at on public.listings;
create trigger update_listings_updated_at
  before update on public.listings
  for each row
  execute function update_updated_at_column();

drop trigger if exists set_listings_property_type_before_write on public.listings;
create trigger set_listings_property_type_before_write
  before insert
  on public.listings
  for each row
  execute function set_listing_property_type_by_text();

-- RLS Policies (optional - adjust based on your security needs)
-- Enable RLS if needed
-- alter table public.sources enable row level security;
-- alter table public.telegram_messages enable row level security;
-- alter table public.telegram_media enable row level security;
-- alter table public.listings enable row level security;
-- alter table public.listing_images enable row level security;
-- alter table public.extraction_runs enable row level security;

-- Example RLS policy for public read access to listings:
-- create policy "Public can read listings" on public.listings
--   for select using (true);
