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

async function fetchListings(
  searchParams: SearchParams,
  page: number
): Promise<{ rows: ListingRow[]; total: number }> {
  const priceMin = searchParams.priceMin as string | undefined;
  const priceMax = searchParams.priceMax as string | undefined;
  const areaMin = searchParams.areaMin as string | undefined;
  const areaMax = searchParams.areaMax as string | undefined;
  const rooms = searchParams.rooms as string | undefined;
  const district = searchParams.district as string | undefined;
  const street = searchParams.street as string | undefined;
  const condition = searchParams.condition as string | undefined;
  const floorMin = searchParams.floorMin as string | undefined;
  const floorMax = searchParams.floorMax as string | undefined;
  const hasBalcony = searchParams.hasBalcony as string | undefined;
  const newBuilding = searchParams.newBuilding as string | undefined;
  const sort = (searchParams.sort as string | undefined) || "newest";
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

    if (rooms) {
      if (rooms === "studio") {
        query = query.ilike("rooms_text", "%studio%");
      } else {
        query = query.eq("rooms_text", rooms);
      }
    }

    if (district) {
      query = query.ilike("district", `%${district}%`);
    }

    if (street) {
      query = query.ilike("street", `%${street}%`);
    }

    if (condition) {
      query = query.eq("condition_norm", condition);
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

const conditions = [
  { value: "", label: "Any condition" },
  { value: "WHITE_FRAME", label: "White frame" },
  { value: "BLACK_FRAME", label: "Black frame" },
  { value: "RENOVATED", label: "Renovated" },
  { value: "FURNISHED", label: "Furnished" }
];

const roomOptions = [
  { value: "", label: "Any rooms" },
  { value: "studio", label: "Studio" },
  { value: "1+1", label: "1+1" },
  { value: "2+1", label: "2+1" },
  { value: "3+1", label: "3+1" }
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "cheapest", label: "Cheapest" },
  { value: "pricePerM2", label: "Price per m²" }
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
  const rooms = (resolvedSearchParams.rooms as string) || "";
  const district = (resolvedSearchParams.district as string) || "";
  const street = (resolvedSearchParams.street as string) || "";
  const condition = (resolvedSearchParams.condition as string) || "";
  const floorMin = (resolvedSearchParams.floorMin as string) || "";
  const floorMax = (resolvedSearchParams.floorMax as string) || "";
  const hasBalcony = (resolvedSearchParams.hasBalcony as string) || "";
  const newBuilding = (resolvedSearchParams.newBuilding as string) || "";
  const sort = (resolvedSearchParams.sort as string) || "newest";
  const propertyType = normalizePropertyType(
    (resolvedSearchParams.propertyType as string) || DEFAULT_PROPERTY_TYPE
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    <div className="flex flex-col gap-5 md:gap-7">
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
        pagination={
          totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <a className="ui-button-ghost" href={buildPageHref(page - 1)}>
                    ← Previous
                  </a>
                ) : (
                  <span className="ui-button-ghost opacity-50">
                    ← Previous
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
                    Next →
                  </a>
                ) : (
                  <span className="ui-button opacity-50">Next →</span>
                )}
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}
