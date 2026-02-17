"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_PROPERTY_TYPE,
  normalizePropertyType,
  PROPERTY_TYPE_OPTIONS
} from "../lib/propertyType";

export default function PropertyTypeNav() {
  const searchParams = useSearchParams();
  const selectedType = normalizePropertyType(searchParams.get("propertyType"));

  const buildHref = (propertyType: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("propertyType", propertyType);
    params.delete("page");
    return `/?${params.toString()}`;
  };

  return (
    <nav className="w-full max-w-[760px]">
      <div className="grid grid-cols-1 gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm sm:grid-cols-3">
        {PROPERTY_TYPE_OPTIONS.map((item) => {
          const isActive =
            item.value === selectedType ||
            (!searchParams.get("propertyType") &&
              item.value === DEFAULT_PROPERTY_TYPE);

          return (
            <Link
              key={item.value}
              href={buildHref(item.value)}
              className={`relative inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-blue-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
