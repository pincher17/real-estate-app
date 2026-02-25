"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import { usePathname, useRouter } from "next/navigation";

type FilterFormProps = {
  initialValues: {
    priceMin: string;
    priceMax: string;
    areaMin: string;
    areaMax: string;
    rooms: string[];
    district: string;
    street: string;
    condition: string[];
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const [priceMin, setPriceMin] = useState(initialValues.priceMin);
  const [priceMax, setPriceMax] = useState(initialValues.priceMax);
  const [areaMin, setAreaMin] = useState(initialValues.areaMin);
  const [areaMax, setAreaMax] = useState(initialValues.areaMax);
  const [district, setDistrict] = useState(initialValues.district);
  const [floorMin, setFloorMin] = useState(initialValues.floorMin);
  const [floorMax, setFloorMax] = useState(initialValues.floorMax);
  const [openDropdown, setOpenDropdown] = useState<
    "min" | "max" | "rooms" | "condition" | "sort" | null
  >(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>(
    initialValues.rooms
  );
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    initialValues.condition
  );
  const [sortValue, setSortValue] = useState(initialValues.sort);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const asText = String(value).trim();
      if (!asText) continue;
      params.append(key, asText);
    }
    const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
    setMobileFiltersOpen(false);
  };
  useEffect(() => {
    setPriceMin(initialValues.priceMin);
    setPriceMax(initialValues.priceMax);
    setAreaMin(initialValues.areaMin);
    setAreaMax(initialValues.areaMax);
    setDistrict(initialValues.district);
    setFloorMin(initialValues.floorMin);
    setFloorMax(initialValues.floorMax);
    setSelectedRooms(initialValues.rooms);
    setSelectedConditions(initialValues.condition);
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

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileFiltersOpen]);

  const priceMinOptions = ["30000", "50000", "75000", "100000", "150000"];
  const priceMaxOptions = ["80000", "120000", "160000", "200000", "250000"];
  const roomOptionsForCheckboxes = roomOptions.filter((opt) => opt.value);
  const conditionsForCheckboxes = conditions.filter((opt) => opt.value);
  const selectedRoomsSet = new Set(selectedRooms);
  const selectedConditionsSet = new Set(selectedConditions);
  const selectedRoomsLabel = selectedRooms
    .map((value) => roomOptions.find((opt) => opt.value === value)?.label || value)
    .join(", ");
  const selectedConditionsLabel = selectedConditions
    .map((value) => conditions.find((opt) => opt.value === value)?.label || value)
    .join(", ");
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (priceMin.trim()) count += 1;
    if (priceMax.trim()) count += 1;
    if (areaMin.trim()) count += 1;
    if (areaMax.trim()) count += 1;
    if (district.trim()) count += 1;
    if (floorMin.trim()) count += 1;
    if (floorMax.trim()) count += 1;
    count += selectedRooms.length;
    count += selectedConditions.length;
    return count;
  }, [
    priceMin,
    priceMax,
    areaMin,
    areaMax,
    district,
    floorMin,
    floorMax,
    selectedRooms,
    selectedConditions
  ]);
  if (!mounted) return null;

  return (
    <form
      ref={formRef}
      className="relative z-30"
      onSubmit={onSubmit}
    >
      <div ref={dropdownRef} className="contents">
        <button
          type="button"
          className="ui-button mb-1 flex h-11 w-full items-center justify-between bg-blue-600 hover:bg-blue-600 active:bg-blue-600 md:hidden"
          onClick={() => {
            setMobileFiltersOpen((prev) => {
              const next = !prev;
              if (!next) setOpenDropdown(null);
              return next;
            });
          }}
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-filters-body"
        >
          <span className="inline-flex items-center gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
              <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
              <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
              <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
            </svg>
            Фильтры
          </span>
          <span className="inline-flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold leading-none text-blue-700">
                {activeFiltersCount}
              </span>
            )}
            <span className="text-xs text-white/90">
              {mobileFiltersOpen ? "Скрыть" : "Открыть"}
            </span>
          </span>
        </button>
        <div
          id="mobile-filters-body"
          className={`${mobileFiltersOpen ? "block" : "hidden"} md:block`}
        >
          <div
            className={`${mobileFiltersOpen ? "fixed inset-0 z-[90] bg-slate-900/35 p-2" : ""} md:static md:bg-transparent md:p-0`}
            onClick={() => {
              if (!mobileFiltersOpen) return;
              setMobileFiltersOpen(false);
              setOpenDropdown(null);
            }}
          >
            <div
              className={`${mobileFiltersOpen ? "absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl" : ""} md:contents`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`ui-card p-3.5 sm:p-4 md:p-5 ${
                  mobileFiltersOpen
                    ? "block h-full max-h-[88vh] overflow-y-auto rounded-t-2xl border-b-0"
                    : "hidden"
                } md:block`}
              >
                <div className="mb-3 flex items-center justify-between md:hidden">
                  <h3 className="text-sm font-semibold text-slate-900">Фильтры</h3>
                  <button
                    type="button"
                    className="ui-button-ghost px-3 py-1.5 text-xs"
                    onClick={() => {
                      setMobileFiltersOpen(false);
                      setOpenDropdown(null);
                    }}
                  >
                    Закрыть
                  </button>
                </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Найти недвижимость в Батуми
            </h2>
            <p className="text-xs text-slate-500">
              Укажите цену, комнаты и район, чтобы сузить поиск.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <input type="hidden" name="sort" value={sortValue} />
            <input
              type="hidden"
              name="propertyType"
              value={initialValues.propertyType}
            />
            {selectedRooms.map((value) => (
              <input key={`room-hidden-${value}`} type="hidden" name="rooms" value={value} />
            ))}
            {selectedConditions.map((value) => (
              <input
                key={`condition-hidden-${value}`}
                type="hidden"
                name="condition"
                value={value}
              />
            ))}
            <div
              className="relative z-20 w-full min-w-0 md:min-w-[200px]"
              data-dropdown-root
            >
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
                  "Сначала новые"}
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

      <div className="mt-4 grid gap-3 sm:gap-4">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Диапазон цены, USD
              </label>
              <span className="text-[11px] text-slate-500">За объект</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative" data-dropdown-root>
                <input
                  type="number"
                  name="priceMin"
                  placeholder="От"
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
                  placeholder="До"
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
                Комнаты
              </label>
            </div>
            <div className="relative z-30" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left overflow-hidden"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) => (prev === "rooms" ? null : "rooms"));
                }}
                title={selectedRoomsLabel || "Любое количество комнат"}
              >
                <span className="block truncate">
                  {selectedRoomsLabel || "Любое количество комнат"}
                </span>
              </button>
              {openDropdown === "rooms" && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {roomOptionsForCheckboxes.map((opt) => (
                      <label
                        key={opt.value}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-blue-50"
                      >
                        <input
                          type="checkbox"
                          value={opt.value}
                          checked={selectedRoomsSet.has(opt.value)}
                          onChange={(e) => {
                            setSelectedRooms((prev) => {
                              if (e.target.checked) {
                                return [...prev, opt.value];
                              }
                              return prev.filter((v) => v !== opt.value);
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Состояние
              </label>
            </div>
            <div className="relative z-20" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left overflow-hidden"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) =>
                    prev === "condition" ? null : "condition"
                  );
                }}
                title={selectedConditionsLabel || "Любое состояние"}
              >
                <span className="block truncate">
                  {selectedConditionsLabel || "Любое состояние"}
                </span>
              </button>
              {openDropdown === "condition" && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {conditionsForCheckboxes.map((opt) => (
                      <label
                        key={`mobile-condition-${opt.value}`}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-blue-50"
                      >
                        <input
                          type="checkbox"
                          value={opt.value}
                          checked={selectedConditionsSet.has(opt.value)}
                          onChange={(e) => {
                            setSelectedConditions((prev) => {
                              if (e.target.checked) {
                                return [...prev, opt.value];
                              }
                              return prev.filter((v) => v !== opt.value);
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Район
              </label>
            </div>
            <input
              type="text"
              name="district"
              placeholder="Район"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="ui-input"
            />
          </div>

        </div>

        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Площадь, м²
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="areaMin"
                placeholder="От"
                value={areaMin}
                onChange={(e) => setAreaMin(e.target.value)}
                className="ui-input"
              />
              <input
                type="number"
                name="areaMax"
                placeholder="До"
                value={areaMax}
                onChange={(e) => setAreaMax(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>

          <div className="hidden space-y-2 md:block">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Состояние
              </label>
            </div>
            <div className="relative z-20" data-dropdown-root>
              <button
                type="button"
                className="ui-select text-left overflow-hidden"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenDropdown((prev) =>
                    prev === "condition" ? null : "condition"
                  );
                }}
                title={selectedConditionsLabel || "Любое состояние"}
              >
                <span className="block truncate">
                  {selectedConditionsLabel || "Любое состояние"}
                </span>
              </button>
              {openDropdown === "condition" && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {conditionsForCheckboxes.map((opt) => (
                      <label
                        key={opt.value}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-blue-50"
                      >
                        <input
                          type="checkbox"
                          value={opt.value}
                          checked={selectedConditionsSet.has(opt.value)}
                          onChange={(e) => {
                            setSelectedConditions((prev) => {
                              if (e.target.checked) {
                                return [...prev, opt.value];
                              }
                              return prev.filter((v) => v !== opt.value);
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex min-h-[22px] items-end">
              <label className="text-xs font-semibold text-slate-700">
                Этаж
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                name="floorMin"
                placeholder="Этаж от"
                value={floorMin}
                onChange={(e) => setFloorMin(e.target.value)}
                className="ui-input"
              />
              <input
                type="number"
                name="floorMax"
                placeholder="Этаж до"
                value={floorMax}
                onChange={(e) => setFloorMax(e.target.value)}
                className="ui-input"
              />
            </div>
          </div>
        </div>
      <div className="sticky bottom-0 mt-5 flex flex-col gap-3 border-t border-slate-200 bg-white pt-3 pb-[calc(env(safe-area-inset-bottom)+10px)] sm:flex-row sm:flex-wrap sm:items-center md:static md:border-0 md:bg-transparent md:py-0">
        <button
          type="button"
          className="ui-button-ghost w-full sm:w-auto"
          onClick={() => {
            setPriceMin("");
            setPriceMax("");
            setAreaMin("");
            setAreaMax("");
            setDistrict("");
            setFloorMin("");
            setFloorMax("");
            setSelectedRooms([]);
            setSelectedConditions([]);
            setSortValue("newest");
            setOpenDropdown(null);
            startTransition(() => {
              router.replace(pathname, { scroll: false });
            });
          }}
        >
          Сбросить фильтры
        </button>
        <button
          type="submit"
          className="ui-button w-full sm:min-w-[180px] sm:w-auto"
          disabled={isPending}
        >
          {isPending ? "Применяем..." : "Применить фильтры"}
        </button>
      </div>
      </div>
      </div>
      </div>
      </div>
      </div>
      </div>
    </form>
  );
}
