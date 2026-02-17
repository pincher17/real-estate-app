"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map, Marker, Popup } from "maplibre-gl";

type MarkerPoint = {
  id: string;
  lat: number;
  lng: number;
  items: {
    id: string;
    title: string;
    priceLabel: string;
    imageUrl?: string | null;
    address?: string | null;
    href?: string;
  }[];
};

export default function ListingMap({
  points,
  selectedId,
  onSelect,
  className
}: {
  points: MarkerPoint[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const pendingCoordsRef = useRef<{
    id: string;
    lat: number;
    lng: number;
  } | null>(null);
  const extraPointsRef = useRef<
    Map<
      string,
      {
        id: string;
        lat: number;
        lng: number;
        items: MarkerPoint["items"];
      }
    >
  >(new Map());

  const mapStyleUrl = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) return "";
    return `https://api.maptiler.com/maps/streets/style.json?key=${key}&language=ru`;
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapStyleUrl) return;
    if (mapRef.current) return;
    let isMounted = true;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (!isMounted || !mapContainer.current) return;
      maplibreRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: mapStyleUrl,
        center: [41.6367, 41.6509], // Batumi
        zoom: 12
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        maxWidth: "260px"
      });
      mapRef.current = map;
      map.on("load", () => setMapReady(true));
    })();

    return () => {
      isMounted = false;
    };
  }, [mapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const extraPoints = Array.from(extraPointsRef.current.values());
    const mergedPoints = [...points, ...extraPoints];
    const nextIds = new Set(mergedPoints.map((p) => p.id));

    for (const [id, marker] of markers.entries()) {
      if (!nextIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const point of mergedPoints) {
      let marker = markers.get(point.id);
      if (!marker) {
        if (!maplibregl) continue;
        const el = document.createElement("div");
        el.className = "listing-marker";
        const pointMeta = points.find((p) => p.id === point.id);
        if (pointMeta) {
          const items = pointMeta.items ?? [
            {
              id: pointMeta.id,
              title: "Apartment",
              priceLabel: ""
            }
          ];
          el.dataset.items = JSON.stringify(items.slice(0, 3));
          el.dataset.count = String(items.length);
        }
        el.addEventListener("mouseenter", () => {
          const popup = popupRef.current;
          const map = mapRef.current;
          if (!popup || !map) return;
          const rawItems = el.dataset.items || "[]";
          const items = JSON.parse(rawItems) as MarkerPoint["items"];
          const count = Number(el.dataset.count || items.length);
          const rows = items
            .map((item) => {
              const image = item.imageUrl
                ? `<div class="map-popup-thumb"><img src="${item.imageUrl}" alt="" /></div>`
                : `<div class="map-popup-thumb"></div>`;
              return `
                <div class="map-popup-row">
                  ${image}
                  <div class="map-popup-body">
                    <div class="map-popup-title">${item.title}</div>
                    <div class="map-popup-price">${item.priceLabel}</div>
                    ${
                      item.address
                        ? `<div class="map-popup-address">${item.address}</div>`
                        : ""
                    }
                  </div>
                </div>
              `;
            })
            .join("");
          const footer =
            count > items.length
              ? `<div class="map-popup-more">+${count - items.length} more</div>`
              : "";
          const html = `
            <div class="map-popup-list">
              ${rows}
              ${footer}
            </div>
          `;
          popup.setLngLat([point.lng, point.lat]).setHTML(html).addTo(map);
        });
        el.addEventListener("mouseleave", () => {
          popupRef.current?.remove();
        });
        el.addEventListener("click", () => {
          if (onSelect) onSelect(point.id);
        });
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
        markers.set(point.id, marker);
      } else {
        marker.setLngLat([point.lng, point.lat]);
      }

      const el = marker.getElement();
      if (selectedId && point.id === selectedId) {
        el.classList.add("listing-marker-selected");
      } else {
        el.classList.remove("listing-marker-selected");
      }
    }

    if (selectedId) {
      const selected = points.find((p) => p.id === selectedId);
      if (selected) {
        map.flyTo({
          center: [selected.lng, selected.lat],
          zoom: 14,
          speed: 1.2
        });
      }
    }
  }, [points, selectedId, mapReady, onSelect]);

  const applyCoords = (detail: { id: string; lat: number; lng: number }) => {
    extraPointsRef.current.set(detail.id, detail);
    const maplibregl = maplibreRef.current;
    const map = mapRef.current;
    if (!maplibregl || !map) return;

    const markers = markersRef.current;
    let marker = markers.get(detail.id);
    if (!marker) {
      const el = document.createElement("div");
      el.className = "listing-marker";
      marker = new maplibregl.Marker({ element: el })
        .setLngLat([detail.lng, detail.lat])
        .addTo(map);
      markers.set(detail.id, marker);
    } else {
      marker.setLngLat([detail.lng, detail.lat]);
    }

    map.flyTo({
      center: [detail.lng, detail.lat],
      zoom: 14,
      speed: 1.2
    });
  };

  useEffect(() => {
    if (!mapReady) return;
    if (!pendingCoordsRef.current) return;
    applyCoords(pendingCoordsRef.current);
    pendingCoordsRef.current = null;
  }, [mapReady]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        id: string;
        lat: number;
        lng: number;
      };
      if (!detail) return;
      if (!mapRef.current || !maplibreRef.current) {
        pendingCoordsRef.current = detail;
        return;
      }
      applyCoords(detail);
    };

    window.addEventListener("listing:coords", handler as EventListener);
    return () => window.removeEventListener("listing:coords", handler as EventListener);
  }, []);

  if (!mapStyleUrl) {
    return (
      <div
        className={`rounded-xl border bg-white/80 p-3 text-xs text-slate-500 ${className || ""}`}
      >
        Map is not configured. Add `NEXT_PUBLIC_MAPTILER_KEY` in
        `.env.local`.
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className={`rounded-xl border bg-white/80 shadow-sm min-h-[320px] ${className || ""}`}
    />
  );
}
