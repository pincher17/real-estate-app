"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const CONDITION_LABELS: Record<string, string> = {
  WHITE_FRAME: "Белый каркас",
  BLACK_FRAME: "Черный каркас",
  RENOVATED: "С ремонтом",
  FURNISHED: "С мебелью"
};

const SEARCH_MIN_TOKEN_LEN = 2;

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .trim();
}

function stemToken(token: string) {
  if (token.length <= 4) return token;
  const suffixes = [
    "иями",
    "ями",
    "ами",
    "ов",
    "ев",
    "ие",
    "ые",
    "ой",
    "ий",
    "ый",
    "ая",
    "ое",
    "ые",
    "ам",
    "ям",
    "ах",
    "ях",
    "ом",
    "ем",
    "ую",
    "юю",
    "а",
    "я",
    "ы",
    "и",
    "у",
    "ю",
    "е",
    "о"
  ];
  const suffix = suffixes.find((item) => token.endsWith(item));
  return suffix ? token.slice(0, -suffix.length) : token;
}

function isOneCharTypo(a: string, b: string) {
  if (a === b) return true;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;
  if (a.length <= 2 || b.length <= 2) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) {
      i += 1;
    } else if (b.length > a.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function doesTokenMatchWord(token: string, word: string) {
  if (!token || !word) return false;
  if (word.includes(token)) return true;

  const tokenStem = stemToken(token);
  const wordStem = stemToken(word);

  if (
    tokenStem.length >= SEARCH_MIN_TOKEN_LEN &&
    wordStem.length >= SEARCH_MIN_TOKEN_LEN &&
    (wordStem.includes(tokenStem) || tokenStem.includes(wordStem))
  ) {
    return true;
  }

  if (
    token.length >= 4 &&
    word.length >= 4 &&
    (word.startsWith(token) || token.startsWith(word))
  ) {
    return true;
  }

  return isOneCharTypo(tokenStem, wordStem);
}

function matchesFlexibleQuery(query: string, rawText: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedRawText = normalizeSearchText(rawText);
  if (!normalizedRawText) return false;

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= SEARCH_MIN_TOKEN_LEN);

  if (!queryTokens.length) return true;
  if (normalizedRawText.includes(normalizedQuery)) return true;

  const words = normalizedRawText
    .split(/\s+/)
    .filter((token) => token.length >= SEARCH_MIN_TOKEN_LEN);

  if (!words.length) return false;

  return queryTokens.every((queryToken) =>
    words.some((word) => doesTokenMatchWord(queryToken, word))
  );
}

export default function ListingsWithMap({
  listings,
  mapListings,
  initialSearchQuery = "",
  pagination
}: {
  listings: ListingRow[];
  mapListings?: ListingRow[];
  initialSearchQuery?: string;
  pagination?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const mapSourceListings = mapListings ?? listings;
  const searchFilteredListings = useMemo(() => {
    const query = initialSearchQuery.trim();
    if (!query) return listings;
    return listings.filter((l) => {
      const searchableRaw = [
        l.description_raw ?? "",
        l.address_text ?? "",
        l.street ?? "",
        l.district ?? "",
        l.building_name ?? ""
      ].join(" ");
      return matchesFlexibleQuery(query, searchableRaw);
    });
  }, [listings, initialSearchQuery]);
  const mapSearchFilteredListings = useMemo(() => {
    const query = initialSearchQuery.trim();
    if (!query) return mapSourceListings;
    return mapSourceListings.filter((l) => {
      const searchableRaw = [
        l.description_raw ?? "",
        l.address_text ?? "",
        l.street ?? "",
        l.district ?? "",
        l.building_name ?? ""
      ].join(" ");
      return matchesFlexibleQuery(query, searchableRaw);
    });
  }, [mapSourceListings, initialSearchQuery]);

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

    mapSearchFilteredListings.forEach((l) => {
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
          (l.rooms_text ? `${l.rooms_text} квартира` : "Квартира");
        const price =
          l.price_usd != null && l.price_usd > 0
            ? `$${l.price_usd.toLocaleString("en-US", {
                maximumFractionDigits: 0
              })}`
            : l.price_value != null
            ? `${l.price_value.toLocaleString("en-US", {
                maximumFractionDigits: 0
              })} ${l.price_currency || ""}`
            : "Цена по запросу";
        const address =
          l.address_text ||
          [l.street, l.district].filter(Boolean).join(", ") ||
          "Батуми";
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
  }, [mapSearchFilteredListings]);

  const listDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        timeZone: "UTC",
        month: "short",
        day: "numeric"
      }),
    []
  );

  useEffect(() => {
    setSearchInput(initialSearchQuery);
    setSearchLoading(false);
  }, [initialSearchQuery]);

  const applySearch = (nextValue: string) => {
    const currentQ = (searchParams.get("q") || "").trim();
    const nextQ = nextValue.trim();
    if (currentQ === nextQ) return;
    setSearchLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (nextQ) {
      params.set("q", nextQ);
    } else {
      params.delete("q");
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch(searchInput);
  };

  useEffect(() => {
    if (!selectedKey) return;
    if (!grouped.has(selectedKey)) {
      setSelectedKey(null);
      setHighlightKey(null);
    }
  }, [grouped, selectedKey]);

  const selectedGroup = selectedKey ? grouped.get(selectedKey) : null;
  const visibleListings = selectedGroup
    ? selectedGroup.listings
    : searchFilteredListings;
  const showListSection = !showMapMobile;
  const showMapSection = showMapMobile;

  return (
    <div className="grid min-w-0 gap-5 pb-24 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:pb-0">
      {searchLoading && (
        <div className="route-loading" aria-hidden="true">
          <span className="route-loading__bar" />
        </div>
      )}
      <div className={`${showListSection ? "" : "hidden lg:block"} min-w-0`}>
        <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-3 sm:p-4 md:p-5">
          <label
            htmlFor="telegram-post-search"
            className="mb-2 block text-sm font-semibold text-slate-800"
          >
            Поиск
          </label>
          <form onSubmit={onSearchSubmit} className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="telegram-post-search"
                type="search"
                value={searchInput}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSearchInput(nextValue);
                  if (!nextValue.trim()) {
                    applySearch("");
                  }
                }}
                placeholder="Например: гагарина 2+1 белый каркас балкон"
                className="h-11 w-full min-w-0 rounded-xl border border-blue-200 bg-white pl-10 pr-2 text-base text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:h-12 sm:pl-12 sm:pr-4 sm:text-[15px]"
              />
            </div>
            <button
              type="submit"
              className="ui-button h-11 w-[78px] flex-none px-0 text-base sm:h-12 sm:w-auto sm:px-4 sm:text-sm"
            >
              Найти
            </button>
          </form>
          {searchInput.trim() && (
            <button
              type="button"
              className="ui-button-ghost mt-2 w-full sm:hidden"
              onClick={() => {
                setSearchInput("");
                applySearch("");
              }}
            >
              Очистить поиск
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            {visibleListings.length} объявлений
          </span>
          <span className="hidden sm:inline text-slate-500">
            Совет: уточните район, комнаты и состояние
          </span>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              (l.rooms_text ? `${l.rooms_text} квартира` : "Квартира");

            const price =
              l.price_usd != null && l.price_usd > 0
                ? `$${l.price_usd.toLocaleString("en-US", {
                    maximumFractionDigits: 0
                  })}`
                : l.price_value != null
                ? `${l.price_value.toLocaleString("en-US", {
                    maximumFractionDigits: 0
                  })} ${l.price_currency || ""}`
                : "Цена по запросу";

            const area =
              l.area_m2 != null ? `${l.area_m2.toFixed(0)} м²` : "Площадь не указана";

            const rooms =
              l.rooms_text ||
              (l.rooms_bedrooms != null ? `${l.rooms_bedrooms}+1` : null);

            const floor =
              l.floor != null
                ? `Этаж ${l.floor}${
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
              "Батуми";

            const canMap = l.lat != null && l.lng != null;

            return (
              <div
                key={l.id}
                className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-shadow hover:shadow-md flex flex-col"
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
                        Нет фото
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-xl bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white shadow">
                      {price}
                    </div>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
                  <h2 className="min-w-0 line-clamp-1 text-[15px] font-semibold text-slate-900">
                    {title}
                  </h2>
                  {l.condition_norm && (
                    <span
                      className="inline-flex w-fit max-w-full rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
                      title={
                        CONDITION_LABELS[l.condition_norm] ||
                        l.condition_norm
                          .toLowerCase()
                          .replace(/_/g, " ")
                          .replace(/^\w/, (c) => c.toUpperCase())
                      }
                    >
                      <span className="block truncate">
                        {CONDITION_LABELS[l.condition_norm] ||
                          l.condition_norm
                            .toLowerCase()
                            .replace(/_/g, " ")
                            .replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                    </span>
                  )}
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
                      setSelectedKey(null);
                      setHighlightKey(key);
                      setShowMapMobile(true);
                    }}
                    className={`line-clamp-1 text-[12px] text-left font-medium ${
                      canMap
                        ? "text-blue-700 hover:underline"
                        : "text-slate-500"
                    }`}
                    title={canMap ? "Показать на карте" : "Координаты пока не указаны"}
                  >
                    {address}
                  </button>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{listDateFormatter.format(posted)}</span>
                    <Link
                      href={`/listings/${l.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      Подробнее →
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
              Показано {visibleListings.length} объявл. в этой точке
            </div>
            <button
              type="button"
              className="ui-button-ghost"
              onClick={() => setSelectedKey(null)}
            >
              Показать все объявления
            </button>
          </div>
        ) : (
          pagination && <div className="mt-5">{pagination}</div>
        )}
      </div>

      <div className={`${showMapSection ? "" : "hidden lg:block"} h-fit lg:sticky lg:top-24 lg:self-start`}>
        <ListingMap
          points={points}
          selectedId={highlightKey || selectedKey || undefined}
          onSelect={(id) => {
            setSelectedKey(id);
            setHighlightKey(id);
            setShowMapMobile(false);
          }}
          className="min-h-[340px] sm:min-h-[460px] lg:min-h-[520px]"
        />
      </div>

      <button
        type="button"
        className="mobile-map-toggle ui-button fixed bottom-4 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full px-5 shadow-lg lg:hidden"
        onClick={() => setShowMapMobile((prev) => !prev)}
      >
        {showMapMobile ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
            <path d="M9 4v14" />
            <path d="M15 6v14" />
            <circle cx="15" cy="10" r="2.5" />
          </svg>
        )}
        <span>{showMapMobile ? "Список" : "Карта"}</span>
      </button>
    </div>
  );
}
