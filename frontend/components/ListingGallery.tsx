"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const prev = () =>
    setActiveIndex((idx) => (idx - 1 + total) % total);
  const next = () => setActiveIndex((idx) => (idx + 1) % total);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
      } else if (event.key === "ArrowLeft" && canNavigate) {
        prev();
      } else if (event.key === "ArrowRight" && canNavigate) {
        next();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen, canNavigate]);

  return (
    <>
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {active?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={title}
            className="h-full w-full cursor-zoom-in object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Нет фото
          </div>
        )}
        {active?.url ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Открыть фото в полном размере"
            className="absolute inset-0 z-10 group"
          >
            <span className="absolute inset-0 bg-slate-900/0 transition group-hover:bg-slate-900/20" />
            <span className="absolute left-1/2 top-1/2 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/20 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
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
          </button>
        ) : null}
        {canNavigate && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-white"
              onClick={prev}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-white"
              onClick={next}
              aria-label="Следующее фото"
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
    {lightboxOpen && active?.url ? (
      <div
        className="fixed inset-0 z-[120] bg-slate-950/90 p-3 md:p-8"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setLightboxOpen(false);
          }
        }}
      >
        {canNavigate && (
          <>
            <button
              type="button"
              className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer"
              onClick={prev}
              aria-label="Зона предыдущего фото"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer"
              onClick={next}
              aria-label="Зона следующего фото"
            />
          </>
        )}
        <button
          type="button"
          className="absolute right-3 top-3 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold leading-none text-white hover:bg-white/25 md:right-6 md:top-6 md:h-14 md:w-14 md:text-3xl"
          onClick={() => setLightboxOpen(false)}
          aria-label="Закрыть просмотр"
        >
          ✕
        </button>
        {canNavigate && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 z-30 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl font-semibold leading-none text-white hover:bg-white/25 md:left-6 md:h-16 md:w-16 md:text-5xl"
              onClick={prev}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 z-30 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl font-semibold leading-none text-white hover:bg-white/25 md:right-6 md:h-16 md:w-16 md:text-5xl"
              onClick={next}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </>
        )}
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={title}
            className="max-h-full max-w-full object-contain"
          />
        </div>
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 z-30 w-[min(92vw,920px)] -translate-x-1/2 rounded-xl bg-slate-900/65 p-2 backdrop-blur">
            <div className="mb-2 text-center text-xs text-slate-200">
              {activeIndex + 1} / {total}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sorted.map((img, idx) => (
                <button
                  key={`lightbox-thumb-${img.url}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border ${
                    idx === activeIndex
                      ? "border-blue-400 ring-2 ring-blue-300/60"
                      : "border-white/30"
                  } bg-slate-800/80`}
                  aria-label={`Открыть фото ${idx + 1}`}
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
    ) : null}
    </>
  );
}
