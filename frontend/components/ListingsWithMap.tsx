"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ListingMap from "./ListingMap";

type ListingRow = {
  id: string;
  price_usd: number | null;
  price_value: number | null;
  price_currency: string | null;
  area_m2: number | null;
  floor: number | null;
  total_floors: number | null;
  rooms_text: string | null;
  rooms_bedrooms: number | null;
  condition_norm: string | null;
  district: string | null;
  street: string | null;
  building_name: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  posted_at: string;
  description_raw: string | null;
  listing_images: { url: string | null; position: number }[] | null;
};

export default function ListingsWithMap({
  listings,
  pagination
}: {
  listings: ListingRow[];
  pagination?: React.ReactNode;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const { points, grouped } = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        lat: number;
        lng: number;
        listings: ListingRow[];
      }
    >();

    listings.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const lat = Number(l.lat);
      const lng = Number(l.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.listings.push(l);
      } else {
        groups.set(key, { key, lat, lng, listings: [l] });
      }
    });

    const points = Array.from(groups.values()).map((group) => {
      const items = group.listings.map((l) => {
        const img =
          l.listing_images && l.listing_images.length
            ? l.listing_images.sort((a, b) => a.position - b.position)[0].url
            : null;
        const title =
          l.building_name ||
          l.district ||
          l.street ||
          (l.rooms_text ? `${l.rooms_text} apartment` : "Apartment");
        const price =
          l.price_usd != null && l.price_usd > 0
            ? `$${l.price_usd.toLocaleString("en-US", {
                maximumFractionDigits: 0
              })}`
            : l.price_value != null
            ? `${l.price_value.toLocaleString("en-US", {
                maximumFractionDigits: 0
              })} ${l.price_currency || ""}`
            : "Price on request";
        const address =
          l.address_text ||
          [l.street, l.district].filter(Boolean).join(", ") ||
          "Batumi";
        return {
          id: l.id,
          title,
          priceLabel: price,
          imageUrl: img,
          address,
          href: `/listings/${l.id}`
        };
      });
      return { id: group.key, lat: group.lat, lng: group.lng, items };
    });

    return { points, grouped: groups };
  }, [listings]);

  const listDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric"
      }),
    []
  );

  const selectedGroup = selectedKey ? grouped.get(selectedKey) : null;
  const visibleListings = selectedGroup
    ? selectedGroup.listings
    : listings;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            {visibleListings.length} listings
          </span>
          <span className="hidden sm:inline text-slate-500">
            Tip: refine by district, rooms or frame type
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleListings.map((l) => {
            const img =
              l.listing_images && l.listing_images.length
                ? l.listing_images.sort((a, b) => a.position - b.position)[0]
                    .url
                : null;

            const title =
              l.building_name ||
              l.district ||
              l.street ||
              (l.rooms_text ? `${l.rooms_text} apartment` : "Apartment");

            const price =
              l.price_usd != null && l.price_usd > 0
                ? `$${l.price_usd.toLocaleString("en-US", {
                    maximumFractionDigits: 0
                  })}`
                : l.price_value != null
                ? `${l.price_value.toLocaleString("en-US", {
                    maximumFractionDigits: 0
                  })} ${l.price_currency || ""}`
                : "Price on request";

            const area =
              l.area_m2 != null ? `${l.area_m2.toFixed(0)} m²` : "Area n/a";

            const rooms =
              l.rooms_text ||
              (l.rooms_bedrooms != null ? `${l.rooms_bedrooms}+1` : null);

            const floor =
              l.floor != null
                ? `Floor ${l.floor}${
                    l.total_floors != null ? ` / ${l.total_floors}` : ""
                  }`
                : null;

            const posted = new Date(l.posted_at);

            const pricePerM2 =
              l.price_usd != null &&
              l.price_usd > 0 &&
              l.area_m2 != null &&
              l.area_m2 > 0
                ? `${Math.round(l.price_usd / l.area_m2).toLocaleString(
                    "en-US"
                  )} $/m²`
                : null;

            const address =
              l.address_text ||
              [l.street, l.district].filter(Boolean).join(", ") ||
              "Batumi";

            const canMap = l.lat != null && l.lng != null;

            return (
              <div
                key={l.id}
                className="group overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <Link
                  href={`/listings/${l.id}`}
                  className="flex flex-col"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                        No photo
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-xl bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white shadow">
                      {price}
                    </div>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="line-clamp-1 text-[15px] font-semibold text-slate-900">
                      {title}
                    </h2>
                    {l.condition_norm && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {l.condition_norm
                          .toLowerCase()
                          .replace(/_/g, " ")
                          .replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                    <span>{area}</span>
                    {rooms && <span>· {rooms}</span>}
                    {floor && <span>· {floor}</span>}
                    {pricePerM2 && <span>· {pricePerM2}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canMap) return;
                      const key = `${Number(l.lat).toFixed(5)},${Number(l.lng).toFixed(5)}`;
                      setHighlightKey(key);
                    }}
                    className={`line-clamp-1 text-[12px] text-left font-medium ${
                      canMap
                        ? "text-blue-700 hover:underline"
                        : "text-slate-500"
                    }`}
                    title={canMap ? "Show on map" : "No coordinates yet"}
                  >
                    {address}
                  </button>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{listDateFormatter.format(posted)}</span>
                    <Link
                      href={`/listings/${l.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {selectedGroup ? (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <div className="text-slate-500">
              Showing {visibleListings.length} listing(s) at this location
            </div>
            <button
              type="button"
              className="ui-button-ghost"
              onClick={() => setSelectedKey(null)}
            >
              Show all listings
            </button>
          </div>
        ) : (
          pagination && <div className="mt-5">{pagination}</div>
        )}
      </div>

      <div className="lg:sticky lg:top-24 h-fit">
        <ListingMap
          points={points}
          selectedId={highlightKey || selectedKey || undefined}
          onSelect={(id) => {
            setSelectedKey(id);
            setHighlightKey(id);
          }}
          className="min-h-[520px]"
        />
      </div>
    </div>
  );
}
