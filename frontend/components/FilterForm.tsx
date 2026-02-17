"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type FilterFormProps = {
  initialValues: {
    priceMin: string;
    priceMax: string;
    areaMin: string;
    areaMax: string;
    rooms: string;
    district: string;
    street: string;
    condition: string;
    floorMin: string;
    floorMax: string;
    hasBalcony: string;
    newBuilding: string;
    sort: string;
    propertyType: string;
  };
  roomOptions: { value: string; label: string }[];
  conditions: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
};

export default function FilterForm({
  initialValues,
  roomOptions,
  conditions,
  sortOptions
}: FilterFormProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [priceMin, setPriceMin] = useState(initialValues.priceMin);
  const [priceMax, setPriceMax] = useState(initialValues.priceMax);
  const [openDropdown, setOpenDropdown] = useState<
    "min" | "max" | "rooms" | "condition" | "sort" | null
  >(null);
  const [roomsValue, setRoomsValue] = useState(initialValues.rooms);
  const [conditionValue, setConditionValue] = useState(
    initialValues.condition
  );
  const [sortValue, setSortValue] = useState(initialValues.sort);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setPriceMin(initialValues.priceMin);
    setPriceMax(initialValues.priceMax);
    setRoomsValue(initialValues.rooms);
    setConditionValue(initialValues.condition);
    setSortValue(initialValues.sort);
  }, [initialValues]);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-dropdown-root]")) return;
      setOpenDropdown(null);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  if (!mounted) return null;
  const priceMinOptions = ["30000", "50000", "75000", "100000", "150000"];
  const priceMaxOptions = ["80000", "120000", "160000", "200000", "250000"];

  return (
    <form
      ref={formRef}
      className="ui-card p-4 md:p-5 relative z-30"
      method="get"
    >
      <div ref={dropdownRef} className="contents">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Find real estate in Batumi
            </h2>
            <p className="text-xs text-slate-500">
              Set a price range, rooms and location to narrow down the list.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input type="hidden" name="sort" value={sortValue} />
            <input
              type="hidden"
              name="propertyType"
              value={initialValues.propertyType}
            />
            <div className="relative min-w-[160px] z-20" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) => (prev === "sort" ? null : "sort"));
                }}
              >
                {sortOptions.find((o) => o.value === sortValue)?.label ||
                  "Newest"}
              </button>
              {openDropdown === "sort" && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSortValue(opt.value);
                        setOpenDropdown(null);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Price range, USD
              </label>
              <span className="text-[11px] text-slate-500">Per object</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative" data-dropdown-root>
                <input
                  type="number"
                  name="priceMin"
                  placeholder="From"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  onFocus={() => setOpenDropdown("min")}
                  className="ui-input pl-6"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-serif">
                  $
                </span>
                {openDropdown === "min" && (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
                    {priceMinOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="block w-full text-left px-3 py-2 hover:bg-blue-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setPriceMin(value);
                          setOpenDropdown(null);
                        }}
                      >
                        <span className="font-serif">$</span>
                        {Number(value).toLocaleString("en-US")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" data-dropdown-root>
                <input
                  type="number"
                  name="priceMax"
                  placeholder="To"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  onFocus={() => setOpenDropdown("max")}
                  className="ui-input pl-6"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-serif">
                  $
                </span>
                {openDropdown === "max" && (
                  <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
                    {priceMaxOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="block w-full text-left px-3 py-2 hover:bg-blue-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setPriceMax(value);
                          setOpenDropdown(null);
                        }}
                      >
                        <span className="font-serif">$</span>
                        {Number(value).toLocaleString("en-US")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Rooms
              </label>
            </div>
            <input type="hidden" name="rooms" value={roomsValue} />
            <div className="relative z-30" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) => (prev === "rooms" ? null : "rooms"));
                }}
              >
                {roomOptions.find((o) => o.value === roomsValue)?.label ||
                  "Any rooms"}
              </button>
              {openDropdown === "rooms" && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
                  {roomOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-blue-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setRoomsValue(opt.value);
                        setOpenDropdown(null);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Location
              </label>
            </div>
            <input
              type="text"
              name="district"
              placeholder="District"
              defaultValue={initialValues.district}
              className="ui-input"
            />
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Floor
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="floorMin"
                placeholder="Floor from"
                defaultValue={initialValues.floorMin}
                className="ui-input"
              />
              <input
                type="number"
                name="floorMax"
                placeholder="Floor to"
                defaultValue={initialValues.floorMax}
                className="ui-input"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Area, m²
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="areaMin"
                placeholder="From"
                defaultValue={initialValues.areaMin}
                className="ui-input"
              />
              <input
                type="number"
                name="areaMax"
                placeholder="To"
                defaultValue={initialValues.areaMax}
                className="ui-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Condition
              </label>
            </div>
            <input type="hidden" name="condition" value={conditionValue} />
            <div className="relative z-20" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) =>
                    prev === "condition" ? null : "condition"
                  );
                }}
              >
                {conditions.find((c) => c.value === conditionValue)?.label ||
                  "Any condition"}
              </button>
              {openDropdown === "condition" && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
                  {conditions.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className="block w-full text-left px-3 py-2 hover:bg-blue-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setConditionValue(c.value);
                        setOpenDropdown(null);
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Street
              </label>
            </div>
            <input
              type="text"
              name="street"
              placeholder="Street"
              defaultValue={initialValues.street}
              className="ui-input"
            />
          </div>
          <div />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="ui-button-ghost"
          onClick={() => {
            setPriceMin("");
            setPriceMax("");
            setRoomsValue("");
            setConditionValue("");
            setSortValue("newest");
            setOpenDropdown(null);
            router.push(pathname);
          }}
        >
          Clear filters
        </button>
        <button type="submit" className="ui-button min-w-[160px]">
          Apply filters
        </button>
      </div>
      </div>
    </form>
  );
}
