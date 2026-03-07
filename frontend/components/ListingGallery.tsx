"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [navHoverSide, setNavHoverSide] = useState<"left" | "right" | null>(null);
  const lightboxImageWrapRef = useRef<HTMLDivElement | null>(null);
  const lightboxImageRef = useRef<HTMLImageElement | null>(null);
  const gestureRef = useRef<{
    mode: "none" | "pinch" | "pan";
    startDistance: number;
    startScale: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    mode: "none",
    startDistance: 0,
    startScale: 1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });

  const clampScale = (value: number) => Math.min(4, Math.max(1, value));
  const clampOffset = (x: number, y: number, scale: number) => {
    const container = lightboxImageWrapRef.current;
    if (!container || scale <= 1) return { x: 0, y: 0 };
    const maxX = ((scale - 1) * container.clientWidth) / 2;
    const maxY = ((scale - 1) * container.clientHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  const resetZoom = () => {
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
    gestureRef.current.mode = "none";
    setIsMouseDragging(false);
    setNavHoverSide(null);
  };
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
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const nextScale = clampScale(zoomScale + 0.2);
        const next = clampOffset(zoomX, zoomY, nextScale);
        setZoomScale(nextScale);
        setZoomX(next.x);
        setZoomY(next.y);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        const nextScale = clampScale(zoomScale - 0.2);
        if (nextScale <= 1.01) {
          resetZoom();
        } else {
          const next = clampOffset(zoomX, zoomY, nextScale);
          setZoomScale(nextScale);
          setZoomX(next.x);
          setZoomY(next.y);
        }
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousLeft = body.style.left;
    const previousRight = body.style.right;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;
    const previousTouchAction = document.documentElement.style.touchAction;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    document.documentElement.style.touchAction = "none";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      const topValue = body.style.top;
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.left = previousLeft;
      body.style.right = previousRight;
      body.style.width = previousWidth;
      document.documentElement.style.touchAction = previousTouchAction;
      window.removeEventListener("keydown", onKeyDown);
      const y = Number.parseInt(topValue || "0", 10);
      window.scrollTo(0, Number.isFinite(y) ? Math.abs(y) : scrollY);
    };
  }, [lightboxOpen, canNavigate, zoomScale, zoomX, zoomY]);

  useEffect(() => {
    resetZoom();
  }, [lightboxOpen, activeIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const node = lightboxImageWrapRef.current;
    if (!node) return;

    const getDistance = (a: Touch, b: Touch) => {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const a = event.touches[0];
        const b = event.touches[1];
        gestureRef.current.mode = "pinch";
        gestureRef.current.startDistance = getDistance(a, b);
        gestureRef.current.startScale = zoomScale;
        event.preventDefault();
        return;
      }
      if (event.touches.length === 1 && zoomScale > 1) {
        const t = event.touches[0];
        gestureRef.current.mode = "pan";
        gestureRef.current.startX = t.clientX;
        gestureRef.current.startY = t.clientY;
        gestureRef.current.originX = zoomX;
        gestureRef.current.originY = zoomY;
        event.preventDefault();
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length >= 2 && gestureRef.current.mode === "pinch") {
        const a = event.touches[0];
        const b = event.touches[1];
        const distance = getDistance(a, b);
        const nextScale = clampScale(
          gestureRef.current.startScale * (distance / gestureRef.current.startDistance)
        );
        const next = clampOffset(zoomX, zoomY, nextScale);
        setZoomScale(nextScale);
        setZoomX(next.x);
        setZoomY(next.y);
        event.preventDefault();
        return;
      }
      if (event.touches.length === 1 && gestureRef.current.mode === "pan" && zoomScale > 1) {
        const t = event.touches[0];
        const dx = t.clientX - gestureRef.current.startX;
        const dy = t.clientY - gestureRef.current.startY;
        const next = clampOffset(
          gestureRef.current.originX + dx,
          gestureRef.current.originY + dy,
          zoomScale
        );
        setZoomX(next.x);
        setZoomY(next.y);
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (zoomScale <= 1.01) {
        resetZoom();
      }
      gestureRef.current.mode = "none";
    };

    node.addEventListener("touchstart", onTouchStart, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd, { passive: false });
    node.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [lightboxOpen, zoomScale, zoomX, zoomY]);

  useEffect(() => {
    if (!lightboxOpen || zoomScale <= 1) return;
    const onMouseUp = () => {
      setIsMouseDragging(false);
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [lightboxOpen, zoomScale]);

  const onDesktopWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!lightboxOpen) return;
    const container = lightboxImageWrapRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const insideImageArea =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!insideImageArea) return;

    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    const nextScale = clampScale(zoomScale + delta);
    if (nextScale <= 1.01) {
      resetZoom();
      return;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const cursorX = event.clientX - centerX;
    const cursorY = event.clientY - centerY;
    const scaleFactor = nextScale / zoomScale;
    const anchoredX = cursorX - (cursorX - zoomX) * scaleFactor;
    const anchoredY = cursorY - (cursorY - zoomY) * scaleFactor;
    const next = clampOffset(anchoredX, anchoredY, nextScale);
    setZoomScale(nextScale);
    setZoomX(next.x);
    setZoomY(next.y);
  };

  const onDesktopMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    event.preventDefault();
    setIsMouseDragging(true);
    gestureRef.current.mode = "pan";
    gestureRef.current.startX = event.clientX;
    gestureRef.current.startY = event.clientY;
    gestureRef.current.originX = zoomX;
    gestureRef.current.originY = zoomY;
  };

  const onDesktopMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDragging || gestureRef.current.mode !== "pan" || zoomScale <= 1) return;
    const dx = event.clientX - gestureRef.current.startX;
    const dy = event.clientY - gestureRef.current.startY;
    const next = clampOffset(
      gestureRef.current.originX + dx,
      gestureRef.current.originY + dy,
      zoomScale
    );
    setZoomX(next.x);
    setZoomY(next.y);
  };

  const onLightboxBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-lightbox-control="1"]')) return;
    const img = lightboxImageRef.current;
    if (!img || !canNavigate) {
      setLightboxOpen(false);
      return;
    }

    const rect = img.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      return;
    }

    if (event.clientX < rect.left) {
      prev();
      return;
    }
    if (event.clientX > rect.right) {
      next();
      return;
    }

    setLightboxOpen(false);
  };

  const updateNavHoverSide = (clientX: number, clientY: number) => {
    const img = lightboxImageRef.current;
    if (!img || !canNavigate) {
      setNavHoverSide(null);
      return;
    }

    const rect = img.getBoundingClientRect();
    const isInsideImage =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    if (isInsideImage) {
      setNavHoverSide(null);
      return;
    }

    if (clientX < rect.left) {
      setNavHoverSide("left");
      return;
    }
    if (clientX > rect.right) {
      setNavHoverSide("right");
      return;
    }

    setNavHoverSide(null);
  };

  const onLightboxBackdropMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    updateNavHoverSide(event.clientX, event.clientY);
  };

  const onImageWrapMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMouseDragging || zoomScale > 1) return;
    updateNavHoverSide(event.clientX, event.clientY);
  };

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
        onClick={onLightboxBackdropClick}
        onMouseMove={onLightboxBackdropMouseMove}
        onMouseLeave={() => setNavHoverSide(null)}
        onWheel={onDesktopWheelZoom}
      >
        <button
          type="button"
          data-lightbox-control="1"
          className="absolute right-3 top-3 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl font-semibold leading-none text-white hover:bg-white/25 md:right-6 md:top-6 md:h-14 md:w-14 md:text-3xl"
          onClick={() => setLightboxOpen(false)}
          aria-label="Закрыть просмотр"
        >
          ✕
        </button>
        <div className="absolute left-1/2 top-3 z-30 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 p-1 text-white md:top-6">
          <button
            type="button"
            data-lightbox-control="1"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none hover:bg-white/20"
            onClick={() => {
              const nextScale = clampScale(zoomScale - 0.2);
              if (nextScale <= 1.01) {
                resetZoom();
              } else {
                const next = clampOffset(zoomX, zoomY, nextScale);
                setZoomScale(nextScale);
                setZoomX(next.x);
                setZoomY(next.y);
              }
            }}
            aria-label="Уменьшить фото"
          >
            -
          </button>
          <button
            type="button"
            data-lightbox-control="1"
            className="min-w-14 rounded-full px-2 py-1 text-xs font-semibold hover:bg-white/20"
            onClick={resetZoom}
            aria-label="Сбросить масштаб"
            title="Сбросить масштаб"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            type="button"
            data-lightbox-control="1"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none hover:bg-white/20"
            onClick={() => {
              const nextScale = clampScale(zoomScale + 0.2);
              const next = clampOffset(zoomX, zoomY, nextScale);
              setZoomScale(nextScale);
              setZoomX(next.x);
              setZoomY(next.y);
            }}
            aria-label="Увеличить фото"
          >
            +
          </button>
        </div>
        {canNavigate && (
          <>
            <button
              type="button"
              data-lightbox-control="1"
              className="absolute left-3 top-1/2 z-30 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl font-semibold leading-none text-white hover:bg-white/25 md:left-6 md:h-16 md:w-16 md:text-5xl"
              onClick={prev}
              aria-label="Предыдущее фото"
            >
              ‹
            </button>
            <button
              type="button"
              data-lightbox-control="1"
              className="absolute right-3 top-1/2 z-30 inline-flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl font-semibold leading-none text-white hover:bg-white/25 md:right-6 md:h-16 md:w-16 md:text-5xl"
              onClick={next}
              aria-label="Следующее фото"
            >
              ›
            </button>
          </>
        )}
        <div
          ref={lightboxImageWrapRef}
          className={`mx-auto flex h-full w-full max-w-[1600px] items-center justify-center overflow-hidden touch-none ${
            isMouseDragging
              ? "cursor-grabbing"
              : navHoverSide
              ? "cursor-pointer"
              : zoomScale <= 1
              ? "cursor-default"
              : "cursor-grab"
          }`}
          onMouseDown={onDesktopMouseDown}
          onMouseMove={(event) => {
            onDesktopMouseMove(event);
            onImageWrapMouseMove(event);
          }}
          onMouseUp={() => setIsMouseDragging(false)}
          onMouseLeave={() => {
            setIsMouseDragging(false);
            setNavHoverSide(null);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={lightboxImageRef}
            src={active.url}
            alt={title}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
            style={{
              transform: `translate3d(${zoomX}px, ${zoomY}px, 0) scale(${zoomScale})`,
              transformOrigin: "center center"
            }}
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
                  data-lightbox-control="1"
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
