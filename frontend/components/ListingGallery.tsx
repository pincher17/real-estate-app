"use client";

import { useMemo, useState } from "react";

type ListingImage = { url: string | null; position: number };

export default function ListingGallery({
  images,
  title
}: {
  images: ListingImage[];
  title: string;
}) {
  const sorted = useMemo(
    () => [...images].sort((a, b) => a.position - b.position),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const active = sorted[activeIndex];
  const total = sorted.length;
  const canNavigate = total > 1;
  const prev = () =>
    setActiveIndex((idx) => (idx - 1 + total) % total);
  const next = () => setActiveIndex((idx) => (idx + 1) % total);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {active?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No photo available
          </div>
        )}
        {canNavigate && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-white"
              onClick={prev}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-white"
              onClick={next}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="border-t bg-slate-50 px-3 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sorted.map((img, idx) => (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-md border ${
                  idx === activeIndex
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-slate-200"
                } bg-slate-100`}
                onClick={() => setActiveIndex(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url ? (
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
