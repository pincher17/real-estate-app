import { supabase } from "../../../lib/supabaseClient";
import AdminEditPanel from "../../../components/AdminEditPanel";
import AdminEditToggle from "../../../components/AdminEditToggle";
import ListingMap from "../../../components/ListingMap";
import ListingGallery from "../../../components/ListingGallery";
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
const detailDateFormatter = new Intl.DateTimeFormat("en-US", {
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
          ← Back to listings
        </Link>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm">Listing not found.</p>
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
      : "Price on request";

  const area =
    listing.area_m2 != null ? `${listing.area_m2.toFixed(0)} m²` : "—";

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
    "Apartment in Batumi";

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

          <div className="ui-card-strong p-4 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <div>
                <div className="text-slate-500">Price</div>
                <div className="font-medium">{price}</div>
              </div>
              <div>
                <div className="text-slate-500">Area</div>
                <div className="font-medium">{area}</div>
              </div>
              <div>
                <div className="text-slate-500">Price per m²</div>
                <div className="font-medium">{pricePerM2 || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Rooms</div>
                <div className="font-medium">{rooms}</div>
              </div>
              <div>
                <div className="text-slate-500">Floor</div>
                <div className="font-medium">{floor}</div>
              </div>
              <div>
                <div className="text-slate-500">Condition</div>
                <div className="font-medium">
                  {listing.condition_norm
                    ? listing.condition_norm
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/^\w/, (c) => c.toUpperCase())
                    : listing.condition_raw || "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500">District</div>
                <div className="font-medium">{listing.district || "—"}</div>
              </div>
              <div className="col-span-2 md:col-span-3">
                <div className="text-slate-500">Address</div>
                <div className="font-medium text-sm text-slate-900">
                  {listing.address_text ||
                    [listing.street, listing.building_name, listing.district]
                      .filter(Boolean)
                      .join(", ") ||
                    "Batumi"}
                </div>
              </div>
            </div>
          </div>

          <div className="ui-card-strong p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>Description (original Telegram)</span>
              <span>
                {detailDateFormatter.format(posted)}
              </span>
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {listing.description_raw}
            </div>
          </div>

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
              <span className="text-slate-500">Telegram link</span>
              {listing.permalink ? (
                <a
                  href={listing.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button px-3 py-1 text-[11px]"
                >
                  Open in Telegram
                </a>
              ) : (
                <span className="text-slate-400">Not available</span>
              )}
            </div>
          </div>

          <div className="ui-card-strong p-4 text-[11px] text-slate-500">
            <p className="mb-1 font-medium text-slate-700">About this data</p>
            <p>
              Listing details are extracted automatically from public Telegram
              posts. Some fields may be incomplete or approximate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
