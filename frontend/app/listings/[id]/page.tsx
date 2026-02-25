import { supabase } from "../../../lib/supabaseClient";
import AdminEditPanel from "../../../components/AdminEditPanel";
import AdminEditToggle from "../../../components/AdminEditToggle";
import ListingMap from "../../../components/ListingMap";
import ListingGallery from "../../../components/ListingGallery";
import TelegramDescription from "../../../components/TelegramDescription";
import Link from "next/link";

type ListingDetail = {
  id: string;
  price_usd: number | null;
  price_value: number | null;
  price_currency: string | null;
  area_m2: number | null;
  floor: number | null;
  total_floors: number | null;
  rooms_text: string | null;
  rooms_bedrooms: number | null;
  rooms_living: number | null;
  condition_norm: string | null;
  condition_raw: string | null;
  district: string | null;
  street: string | null;
  building_name: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  description_raw: string | null;
  property_type: string | null;
  permalink: string | null;
  posted_at: string;
  listing_images: { url: string | null; position: number }[] | null;
};

const CONDITION_LABELS: Record<string, string> = {
  WHITE_FRAME: "Белый каркас",
  BLACK_FRAME: "Черный каркас",
  RENOVATED: "С ремонтом",
  FURNISHED: "С мебелью"
};

async function fetchListing(id: string): Promise<ListingDetail | null> {
  const buildQuery = (withPropertyType: boolean) =>
    supabase
      .from("listings")
      .select(
        withPropertyType
          ? `
      id,
      price_usd,
      price_value,
      price_currency,
      area_m2,
      floor,
      total_floors,
      rooms_text,
      rooms_bedrooms,
      rooms_living,
      condition_norm,
      condition_raw,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      description_raw,
      property_type,
      permalink,
      posted_at,
      listing_images (
        url,
        position
      )
    `
          : `
      id,
      price_usd,
      price_value,
      price_currency,
      area_m2,
      floor,
      total_floors,
      rooms_text,
      rooms_bedrooms,
      rooms_living,
      condition_norm,
      condition_raw,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      description_raw,
      permalink,
      posted_at,
      listing_images (
        url,
        position
      )
    `
      )
      .eq("id", id)
      .maybeSingle();

  let { data, error } = await buildQuery(true);

  if (error) {
    console.warn(
      "fetchListing query with property_type failed, retrying without property_type",
      error
    );
    const fallback = await buildQuery(false);
    data = fallback.data as any;
    error = fallback.error as any;
  }

  if (error) {
    console.error("fetchListing error", error);
    return null;
  }
  if (!data) return null;

  return data as any as ListingDetail;
}

export const dynamic = "force-dynamic";
const detailDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric"
});

export default async function ListingPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const listing = await fetchListing(resolvedParams.id);

  if (!listing) {
    return (
      <div className="space-y-3">
        <Link href="/" className="text-xs text-slate-600 hover:underline">
          ← К объявлениям
        </Link>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm">Объявление не найдено.</p>
        </div>
      </div>
    );
  }

  const images =
    listing.listing_images && listing.listing_images.length
      ? [...listing.listing_images].sort((a, b) => a.position - b.position)
      : [];

  const price =
    listing.price_usd != null && listing.price_usd > 0
      ? `$${listing.price_usd.toLocaleString("en-US", {
          maximumFractionDigits: 0
        })}`
      : listing.price_value != null
      ? `${listing.price_value.toLocaleString("en-US", {
          maximumFractionDigits: 0
        })} ${listing.price_currency || ""}`
      : "Цена по запросу";

  const area =
    listing.area_m2 != null ? `${listing.area_m2.toFixed(0)} м²` : "—";

  const rooms =
    listing.rooms_text ||
    (listing.rooms_bedrooms != null
      ? `${listing.rooms_bedrooms} + ${listing.rooms_living ?? 1}`
      : "—");

  const floor =
    listing.floor != null
      ? `${listing.floor}${
          listing.total_floors != null ? ` / ${listing.total_floors}` : ""
        }`
      : "—";

  const title =
    listing.building_name ||
    listing.address_text ||
    [listing.street, listing.district].filter(Boolean).join(", ") ||
    "Квартира в Батуми";

  const posted = new Date(listing.posted_at);

  const pricePerM2 =
    listing.price_usd != null &&
    listing.price_usd > 0 &&
    listing.area_m2 != null &&
    listing.area_m2 > 0
      ? `${Math.round(listing.price_usd / listing.area_m2).toLocaleString(
          "en-US"
        )} $/m²`
      : null;
  const conditionLabel = listing.condition_norm
    ? CONDITION_LABELS[listing.condition_norm] ||
      listing.condition_norm
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase())
    : listing.condition_raw || "—";
  const addressLabel =
    listing.address_text ||
    [listing.street, listing.building_name, listing.district]
      .filter(Boolean)
      .join(", ") ||
    "Батуми";

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] md:gap-5">
        <div className="space-y-3">
          <div className="relative">
            <ListingGallery images={images} title={title} />
            <div className="absolute left-4 top-4 rounded-xl bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white shadow">
              {price}
            </div>
          </div>

          <div className="ui-card-strong overflow-hidden border-slate-200/80">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 md:px-5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Основная информация
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
                {title}
              </h2>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                <div className="text-3xl font-semibold leading-none md:text-4xl">
                  {price}
                </div>
                <div className="text-sm text-slate-500">
                  {pricePerM2 || "—"} за м²
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-3 md:gap-3 md:p-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Площадь
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {area}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Комнаты
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {rooms}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Этаж
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {floor}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Состояние
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {conditionLabel}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Район
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {listing.district || "—"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Дата
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {detailDateFormatter.format(posted)}
                </div>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 md:col-span-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Адрес
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {addressLabel}
                </div>
              </div>
            </div>
          </div>

          <TelegramDescription
            text={listing.description_raw}
            postedLabel={detailDateFormatter.format(posted)}
          />

          <AdminEditToggle>
            <AdminEditPanel
              listing={{
                id: listing.id,
                price_value: listing.price_value,
                price_currency: listing.price_currency,
                price_usd: listing.price_usd,
                area_m2: listing.area_m2,
                floor: listing.floor,
                total_floors: listing.total_floors,
                rooms_text: listing.rooms_text,
                rooms_bedrooms: listing.rooms_bedrooms,
                rooms_living: listing.rooms_living,
                condition_norm: listing.condition_norm,
                district: listing.district,
                building_name: listing.building_name,
                address_text: listing.address_text,
                lat: listing.lat,
                lng: listing.lng,
                description_raw: listing.description_raw,
                property_type: listing.property_type
              }}
            />
          </AdminEditToggle>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
          {listing.lat != null && listing.lng != null && (
            <ListingMap
              points={[
                {
                  id: listing.id,
                  lat: listing.lat,
                  lng: listing.lng,
                  items: [
                    {
                      id: listing.id,
                      title,
                      priceLabel: price,
                      address:
                        listing.address_text ||
                        [listing.street, listing.district]
                          .filter(Boolean)
                          .join(", ")
                    }
                  ]
                }
              ]}
              selectedId={listing.id}
              className="min-h-[260px]"
            />
          )}

          <div className="ui-card-strong p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Ссылка на Telegram</span>
              {listing.permalink ? (
                <a
                  href={listing.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button px-3 py-1 text-[11px]"
                >
                  Открыть в Telegram
                </a>
              ) : (
                <span className="text-slate-400">Недоступно</span>
              )}
            </div>
          </div>

          <div className="ui-card-strong p-4 text-[11px] text-slate-500">
            <p className="mb-1 font-medium text-slate-700">О данных</p>
            <p>
              Данные объявления автоматически извлекаются из публичных
              Telegram-постов. Часть полей может быть неполной или приблизительной.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
