import { supabase } from "../lib/supabaseClient";
import FilterForm from "../components/FilterForm";
import ListingsWithMap from "../components/ListingsWithMap";
import {
  DEFAULT_PROPERTY_TYPE,
  normalizePropertyType
} from "../lib/propertyType";

type SearchParams = { [key: string]: string | string[] | undefined };

const PAGE_SIZE = 72;

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
  property_type: string | null;
  listing_images: { url: string | null; position: number }[] | null;
};

function getMultiParam(
  value: string | string[] | undefined
): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchListings(
  searchParams: SearchParams,
  page: number
): Promise<{ rows: ListingRow[]; total: number }> {
  const allowedRooms = new Set([
    "studio",
    "1+1",
    "2+1",
    "3+1",
    "4+1",
    "5+1",
    "open_plan"
  ]);
  const allowedConditions = new Set([
    "WHITE_FRAME",
    "BLACK_FRAME",
    "RENOVATED",
    "FURNISHED"
  ]);
  const priceMin = searchParams.priceMin as string | undefined;
  const priceMax = searchParams.priceMax as string | undefined;
  const areaMin = searchParams.areaMin as string | undefined;
  const areaMax = searchParams.areaMax as string | undefined;
  const rooms = getMultiParam(searchParams.rooms).filter((value) =>
    allowedRooms.has(value)
  );
  const district = searchParams.district as string | undefined;
  const street = searchParams.street as string | undefined;
  const condition = getMultiParam(searchParams.condition).filter((value) =>
    allowedConditions.has(value)
  );
  const floorMin = searchParams.floorMin as string | undefined;
  const floorMax = searchParams.floorMax as string | undefined;
  const hasBalcony = searchParams.hasBalcony as string | undefined;
  const newBuilding = searchParams.newBuilding as string | undefined;
  const sort = (searchParams.sort as string | undefined) || "newest";
  const qRaw = (searchParams.q as string | undefined) || "";
  const q = qRaw.trim().replace(/[%]/g, "").replace(/,/g, " ");
  const propertyType = normalizePropertyType(
    searchParams.propertyType as string | undefined
  );
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const buildQuery = (withPropertyType: boolean) => {
    let query = supabase.from("listings").select(
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
      condition_norm,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      posted_at,
      description_raw,
      property_type,
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
      condition_norm,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      posted_at,
      description_raw,
      listing_images (
        url,
        position
      )
    `,
      { count: "exact" }
    );

    if (withPropertyType) {
      query = query.eq("property_type", propertyType);
    }

    // Filters
    if (priceMin) query = query.gte("price_usd", Number(priceMin));
    if (priceMax) query = query.lte("price_usd", Number(priceMax));
    if (areaMin) query = query.gte("area_m2", Number(areaMin));
    if (areaMax) query = query.lte("area_m2", Number(areaMax));

    if (rooms.length) {
      const roomFilters: string[] = [];
      rooms.forEach((room) => {
        if (room === "studio") {
          roomFilters.push("rooms_text.ilike.%studio%");
          return;
        }
        if (room === "open_plan") {
          roomFilters.push("rooms_text.eq.open_plan");
          roomFilters.push("rooms_text.ilike.%open%plan%");
          return;
        }
        roomFilters.push(`rooms_text.eq.${room}`);
      });
      if (roomFilters.length) {
        query = query.or(roomFilters.join(","));
      }
    }

    if (district) {
      query = query.ilike("district", `%${district}%`);
    }

    if (street) {
      query = query.ilike("street", `%${street}%`);
    }

    if (condition.length) {
      query = query.in("condition_norm", condition);
    }

    if (q) {
      query = query.or(
        [
          `description_raw.ilike.%${q}%`,
          `building_name.ilike.%${q}%`,
          `address_text.ilike.%${q}%`,
          `street.ilike.%${q}%`,
          `district.ilike.%${q}%`
        ].join(",")
      );
    }

    if (floorMin) query = query.gte("floor", Number(floorMin));
    if (floorMax) query = query.lte("floor", Number(floorMax));

    // Basic sort in DB
    if (sort === "cheapest") {
      query = query.order("price_usd", { ascending: true, nullsFirst: false });
    } else {
      // newest
      query = query.order("posted_at", { ascending: false });
    }

    return query.range(from, to);
  };

  let { data, error, count } = await buildQuery(true);

  if (error || !data) {
    // Backward compatibility: database may not have property_type yet.
    if (propertyType !== DEFAULT_PROPERTY_TYPE) {
      return { rows: [], total: 0 };
    }

    console.warn(
      "Supabase query with property_type failed, retrying without property_type",
      error
    );
    const fallback = await buildQuery(false);
    data = fallback.data as any;
    error = fallback.error as any;
    count = fallback.count as any;

    if (error || !data) {
      console.error("Supabase listings error", error);
      return { rows: [], total: 0 };
    }
  }

  let rows = data as any as ListingRow[];
  let total = count ?? rows.length;

  // Text-based filters applied in memory for MVP
  if (hasBalcony === "1") {
    const balconyRegex = /(balcony|ბალკონ|балкон)/i;
    rows = rows.filter((r) => balconyRegex.test(r.description_raw ?? ""));
    total = rows.length;
  }

  if (newBuilding === "1") {
    const newBuildRegex = /(new building|новострой|новостройк|новый дом)/i;
    rows = rows.filter((r) => newBuildRegex.test(r.description_raw ?? ""));
    total = rows.length;
  }

  // Sort by price per m² in memory
  if (sort === "pricePerM2") {
    rows = [...rows].sort((a, b) => {
      const aRatio =
        a.price_usd != null && a.area_m2 != null && a.area_m2 > 0
          ? a.price_usd / a.area_m2
          : Number.POSITIVE_INFINITY;
      const bRatio =
        b.price_usd != null && b.area_m2 != null && b.area_m2 > 0
          ? b.price_usd / b.area_m2
          : Number.POSITIVE_INFINITY;
      return aRatio - bRatio;
    });
  }

  return { rows, total };
}

async function fetchMapListingsAll(
  propertyType: string
): Promise<ListingRow[]> {
  const buildQuery = (withPropertyType: boolean) => {
    let query = supabase.from("listings").select(
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
      condition_norm,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      posted_at,
      description_raw,
      property_type,
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
      condition_norm,
      district,
      street,
      building_name,
      address_text,
      lat,
      lng,
      posted_at,
      description_raw,
      listing_images (
        url,
        position
      )
    `
    );

    if (withPropertyType) {
      query = query.eq("property_type", propertyType);
    }

    return query.order("posted_at", { ascending: false });
  };

  let { data, error } = await buildQuery(true);

  if (error || !data) {
    if (propertyType !== DEFAULT_PROPERTY_TYPE) {
      return [];
    }
    const fallback = await buildQuery(false);
    data = fallback.data as any;
    error = fallback.error as any;
    if (error || !data) {
      console.error("Supabase map listings error", error);
      return [];
    }
  }

  return data as any as ListingRow[];
}

function hasActiveFiltersOrSearch(searchParams: SearchParams): boolean {
  const keysToCheck = [
    "q",
    "priceMin",
    "priceMax",
    "areaMin",
    "areaMax",
    "rooms",
    "district",
    "street",
    "condition",
    "floorMin",
    "floorMax",
    "hasBalcony",
    "newBuilding"
  ] as const;

  return keysToCheck.some((key) => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value.some((item) => item.trim() !== "");
    }
    return (value || "").trim() !== "";
  });
}

const conditions = [
  { value: "", label: "Любое состояние" },
  { value: "WHITE_FRAME", label: "Белый каркас" },
  { value: "BLACK_FRAME", label: "Черный каркас" },
  { value: "RENOVATED", label: "С ремонтом" },
  { value: "FURNISHED", label: "С мебелью" }
];

const roomOptions = [
  { value: "", label: "Любое количество комнат" },
  { value: "studio", label: "Студия" },
  { value: "1+1", label: "1+1" },
  { value: "2+1", label: "2+1" },
  { value: "3+1", label: "3+1" },
  { value: "4+1", label: "4+1" },
  { value: "5+1", label: "5+" },
  { value: "open_plan", label: "Открытая планировка" }
];

const sortOptions = [
  { value: "newest", label: "Сначала новые" },
  { value: "cheapest", label: "Сначала дешевле" },
  { value: "pricePerM2", label: "Цена за м²" }
];

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageParam = resolvedSearchParams.page as string | undefined;
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);
  const { rows: listings, total } = await fetchListings(
    resolvedSearchParams,
    page
  );

  const priceMin = (resolvedSearchParams.priceMin as string) || "";
  const priceMax = (resolvedSearchParams.priceMax as string) || "";
  const areaMin = (resolvedSearchParams.areaMin as string) || "";
  const areaMax = (resolvedSearchParams.areaMax as string) || "";
  const rooms = getMultiParam(resolvedSearchParams.rooms);
  const district = (resolvedSearchParams.district as string) || "";
  const street = (resolvedSearchParams.street as string) || "";
  const condition = getMultiParam(resolvedSearchParams.condition);
  const floorMin = (resolvedSearchParams.floorMin as string) || "";
  const floorMax = (resolvedSearchParams.floorMax as string) || "";
  const hasBalcony = (resolvedSearchParams.hasBalcony as string) || "";
  const newBuilding = (resolvedSearchParams.newBuilding as string) || "";
  const sort = (resolvedSearchParams.sort as string) || "newest";
  const propertyType = normalizePropertyType(
    (resolvedSearchParams.propertyType as string) || DEFAULT_PROPERTY_TYPE
  );
  const q = ((resolvedSearchParams.q as string) || "").trim();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const useFullMapDataset = !hasActiveFiltersOrSearch(resolvedSearchParams);
  const mapListings = useFullMapDataset
    ? await fetchMapListingsAll(propertyType)
    : listings;

  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    Object.entries(resolvedSearchParams).forEach(([key, value]) => {
      if (key === "page") return;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else if (value != null && value !== "") {
        params.set(key, value);
      }
    });
    params.set("page", String(nextPage));
    return `/?${params.toString()}`;
  };

  const pageItems: Array<number | string> = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: Array<number | string> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) items.push("…");
    for (let p = start; p <= end; p += 1) items.push(p);
    if (end < totalPages - 1) items.push("…");
    items.push(totalPages);
    return items;
  })();

  return (
    <div className="grid min-w-0 gap-5 md:gap-7">
      <FilterForm
        initialValues={{
          priceMin,
          priceMax,
          areaMin,
          areaMax,
          rooms,
          district,
          street,
          condition,
          floorMin,
          floorMax,
          hasBalcony,
          newBuilding,
          sort,
          propertyType
        }}
        roomOptions={roomOptions}
        conditions={conditions}
        sortOptions={sortOptions}
      />

      <ListingsWithMap
        listings={listings}
        mapListings={mapListings}
        initialSearchQuery={q}
        pagination={
          totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <a className="ui-button-ghost" href={buildPageHref(page - 1)}>
                    ← Назад
                  </a>
                ) : (
                  <span className="ui-button-ghost opacity-50">
                    ← Назад
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {pageItems.map((item, idx) =>
                    typeof item !== "number" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <a
                        key={item}
                        href={buildPageHref(item)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm ${
                          item === page
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </a>
                    )
                  )}
                </div>
                {page < totalPages ? (
                  <a className="ui-button" href={buildPageHref(page + 1)}>
                    Далее →
                  </a>
                ) : (
                  <span className="ui-button opacity-50">Далее →</span>
                )}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
