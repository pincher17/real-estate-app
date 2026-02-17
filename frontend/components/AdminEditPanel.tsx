"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { PROPERTY_TYPE_OPTIONS } from "../lib/propertyType";

type ListingEditData = {
  id: string;
  price_value: number | null;
  price_currency: string | null;
  price_usd: number | null;
  area_m2: number | null;
  floor: number | null;
  total_floors: number | null;
  rooms_text: string | null;
  rooms_bedrooms: number | null;
  rooms_living: number | null;
  condition_norm: string | null;
  district: string | null;
  building_name: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  description_raw: string | null;
  property_type: string | null;
};

type AdminStatus = "loading" | "admin" | "not_admin";

export default function AdminEditPanel({
  listing
}: {
  listing: ListingEditData;
}) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus>("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [suggestions, setSuggestions] = useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const initialForm = {
    price_value: listing.price_usd ?? listing.price_value ?? "",
    area_m2: listing.area_m2 ?? "",
    floor: listing.floor ?? "",
    total_floors: listing.total_floors ?? "",
    rooms_text: listing.rooms_text ?? "",
    rooms_bedrooms: listing.rooms_bedrooms ?? "",
    rooms_living: listing.rooms_living ?? "",
    condition_norm: listing.condition_norm ?? "",
    district: listing.district ?? "",
    building_name: listing.building_name ?? "",
    address_text: listing.address_text ?? "",
    lat: listing.lat ?? "",
    lng: listing.lng ?? "",
    description_raw: listing.description_raw ?? "",
    property_type: listing.property_type ?? "apartment"
  };

  const [manualCoords, setManualCoords] = useState(false);
  const [editedAddress, setEditedAddress] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const suppressSuggestRef = useRef(false);
  const router = useRouter();
  const inputRefs = useRef<
    Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>
  >({});

  const [form, setForm] = useState(() => initialForm);
  const formRef = useRef(form);
  const initialRef = useRef(initialForm);
  const roomOptions = [
    { value: "", label: "—" },
    { value: "studio", label: "Studio" },
    { value: "open_plan", label: "Open plan" },
    { value: "1+1", label: "1+1" },
    { value: "2+1", label: "2+1" },
    { value: "3+1", label: "3+1" },
    { value: "4+1", label: "4+1" },
    { value: "5+", label: "5+" }
  ];
  const conditionOptions = [
    "",
    "WHITE_FRAME",
    "BLACK_FRAME",
    "RENOVATED",
    "FURNISHED"
  ];
  const propertyTypeOptions = PROPERTY_TYPE_OPTIONS;

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const isDirty = useMemo(() => {
    return true;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        if (mounted) setAdminStatus("not_admin");
        return;
      }

      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (mounted) {
        setAdminStatus(json.isAdmin ? "admin" : "not_admin");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function toNumberOrNull(value: string) {
    if (value.trim() === "") return null;
    const normalized = value.replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  function deriveStreet(addressText?: string | null) {
    const trimmed = (addressText ?? "").trim();
    if (!trimmed) return null;
    const beforeComma = trimmed.split(",")[0]?.trim();
    return beforeComma || null;
  }

  function markTouched(key: string) {
    setTouched((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  }

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      formRef.current = next;
      return next;
    });
    markTouched(String(key));
  }

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) return;
    if (manualCoords) return;
    if (!editedAddress) {
      setSuggestions([]);
      return;
    }
    let query = form.address_text?.toString().trim() || "";
    if (query.length < 4) {
      setSuggestions([]);
      return;
    }
    if (!/batumi|батуми/i.test(query)) {
      query = `${query}, Batumi`;
    }

    const timeout = setTimeout(async () => {
      if (suppressSuggestRef.current) {
        suppressSuggestRef.current = false;
        return;
      }
      setSearching(true);
      try {
        const baseUrl = new URL(
          "https://api.maptiler.com/geocoding/" + encodeURIComponent(query) + ".json"
        );
        baseUrl.searchParams.set("key", key);
        baseUrl.searchParams.set("limit", "6");
        baseUrl.searchParams.set("language", "ru");
        baseUrl.searchParams.set("country", "GE");
        baseUrl.searchParams.set("types", "address,street");
        baseUrl.searchParams.set("bbox", "41.45,41.52,41.85,41.78");
        baseUrl.searchParams.set("autocomplete", "true");
        baseUrl.searchParams.set("fuzzyMatch", "true");

        const res = await fetch(baseUrl.toString());
        const json = await res.json();
        let features = json.features || [];

        if (!features.length) {
          const fallbackQuery = query.replace(/\d+[a-zA-Zа-яА-Я-]*\s*$/g, "");
          const fallbackUrl = new URL(
            "https://api.maptiler.com/geocoding/" +
              encodeURIComponent(fallbackQuery.trim()) +
              ".json"
          );
          fallbackUrl.searchParams.set("key", key);
          fallbackUrl.searchParams.set("limit", "6");
          fallbackUrl.searchParams.set("language", "ru");
          fallbackUrl.searchParams.set("country", "GE");
          fallbackUrl.searchParams.set("types", "street,locality,place");
          fallbackUrl.searchParams.set("bbox", "41.45,41.52,41.85,41.78");
          fallbackUrl.searchParams.set("autocomplete", "true");
          fallbackUrl.searchParams.set("fuzzyMatch", "true");
          const fallbackRes = await fetch(fallbackUrl.toString());
          const fallbackJson = await fallbackRes.json();
          features = fallbackJson.features || [];
        }

        const next = features
          .filter((f: any) => Array.isArray(f.center))
          .map((f: any) => {
            const raw = String(f.place_name || f.text || "").trim();
            const label = raw
              .replace(/,?\s*\d{4,6}/g, "")
              .replace(/,\s*Georgia$/i, "")
              .replace(/,\s*Грузия$/i, "")
              .trim();
            return {
              label,
              lat: f.center[1],
              lng: f.center[0]
            };
          });
        setSuggestions(next);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [form.address_text, manualCoords, editedAddress]);

  useEffect(() => {
    if (listing.lat != null && listing.lng != null) {
      setManualCoords(true);
      setSuggestions([]);
    }
  }, [listing.lat, listing.lng]);

  function buildPayload(
    nextForm: typeof form,
    includeKeys?: Set<string>
  ) {
    const priceValue = toNumberOrNull(String(nextForm.price_value));
    const derivedStreet = deriveStreet(nextForm.address_text);
    const payload: Record<string, any> = {};

    const isTouched = (key: string) =>
      includeKeys ? includeKeys.has(key) : Boolean(touched[key]);

    if (isTouched("price_value")) {
      if (priceValue == null) {
        payload.price_value = null;
        payload.price_currency = null;
        payload.price_usd = null;
      } else {
        payload.price_value = priceValue;
        payload.price_currency = "USD";
        payload.price_usd = priceValue;
      }
    }

    const area = toNumberOrNull(String(nextForm.area_m2));
    if (isTouched("area_m2")) payload.area_m2 = area;

    const floor = toNumberOrNull(String(nextForm.floor));
    if (isTouched("floor")) payload.floor = floor;

    const totalFloors = toNumberOrNull(String(nextForm.total_floors));
    if (isTouched("total_floors")) payload.total_floors = totalFloors;

    if (isTouched("rooms_text")) payload.rooms_text = nextForm.rooms_text || null;
    const bedrooms = toNumberOrNull(String(nextForm.rooms_bedrooms));
    if (isTouched("rooms_bedrooms")) payload.rooms_bedrooms = bedrooms;
    const living = toNumberOrNull(String(nextForm.rooms_living));
    if (isTouched("rooms_living")) payload.rooms_living = living;

    if (isTouched("condition_norm"))
      payload.condition_norm = nextForm.condition_norm || null;

    if (isTouched("district")) payload.district = nextForm.district || null;

    if (isTouched("address_text")) {
      const raw = String(nextForm.address_text ?? "");
      const normalized = raw.trim();
      payload.address_text = normalized === "" ? null : raw;
      payload.street = normalized === "" ? null : deriveStreet(raw);
    }

    if (isTouched("building_name"))
      payload.building_name = nextForm.building_name || null;

    const lat = toNumberOrNull(String(nextForm.lat));
    const lng = toNumberOrNull(String(nextForm.lng));
    if (isTouched("lat") || isTouched("lng")) {
      payload.lat = lat;
      payload.lng = lng;
    }

    if (isTouched("description_raw"))
      payload.description_raw = nextForm.description_raw || null;
    if (isTouched("property_type"))
      payload.property_type = nextForm.property_type || "apartment";

    return payload;
  }

  async function pasteCoordsFromClipboard(saveAfter = false) {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const match = text.match(
        /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
      );
      if (!match) {
        setError("Clipboard does not contain coordinates.");
        return;
      }
      const lat = match[1];
      const lng = match[2];
      const nextForm = { ...form, lat, lng };
      setForm(nextForm);
      formRef.current = nextForm;
      setTouched((prev) => ({ ...prev, lat: true, lng: true }));
      setManualCoords(true);
      setSuggestions([]);
      setSearching(false);
      if (saveAfter) {
        void onSave(nextForm, ["lat", "lng"]);
      }
    } catch {
      setError("Failed to read clipboard.");
    }
  }

  async function onSave(nextFormOverride?: typeof form, forceKeys?: string[]) {
    setSaving(true);
    setError("");
    const {
      data: { session }
    } = await supabaseBrowser.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("Not authenticated.");
      setSaving(false);
      return;
    }

    const currentForm = nextFormOverride || formRef.current;
    const readValue = (key: keyof typeof form) => {
      const ref = inputRefs.current[String(key)];
      if (ref) return ref.value;
      const fallback = currentForm[key];
      return fallback == null ? "" : String(fallback);
    };
    const effectiveForm = {
      ...currentForm,
      price_value: readValue("price_value"),
      area_m2: readValue("area_m2"),
      floor: readValue("floor"),
      total_floors: readValue("total_floors"),
      rooms_text: readValue("rooms_text"),
      rooms_bedrooms: readValue("rooms_bedrooms"),
      rooms_living: readValue("rooms_living"),
      condition_norm: readValue("condition_norm"),
      district: readValue("district"),
      building_name: readValue("building_name"),
      address_text: readValue("address_text"),
      lat: readValue("lat"),
      lng: readValue("lng"),
      description_raw: readValue("description_raw"),
      property_type: readValue("property_type")
    };
    const includeKeys = new Set<string>();
    Object.keys(touched).forEach((key) => {
      if (touched[key]) includeKeys.add(key);
    });
    if (forceKeys) {
      forceKeys.forEach((key) => includeKeys.add(key));
    }

    const initial = initialRef.current;
    const numKeys = new Set([
      "price_value",
      "area_m2",
      "floor",
      "total_floors",
      "rooms_bedrooms",
      "rooms_living"
    ]);
    const strKeys = [
      "rooms_text",
      "condition_norm",
      "property_type",
      "district",
      "building_name",
      "address_text",
      "description_raw"
    ];

    const normalizeNum = (value: unknown) =>
      toNumberOrNull(String(value ?? ""));
    const normalizeStr = (value: unknown) =>
      String(value ?? "").trim();

    if (normalizeNum(effectiveForm.price_value) !== normalizeNum(initial.price_value))
      includeKeys.add("price_value");
    if (normalizeNum(effectiveForm.area_m2) !== normalizeNum(initial.area_m2))
      includeKeys.add("area_m2");
    if (normalizeNum(effectiveForm.floor) !== normalizeNum(initial.floor))
      includeKeys.add("floor");
    if (
      normalizeNum(effectiveForm.total_floors) !==
      normalizeNum(initial.total_floors)
    )
      includeKeys.add("total_floors");
    if (
      normalizeNum(effectiveForm.rooms_bedrooms) !==
      normalizeNum(initial.rooms_bedrooms)
    )
      includeKeys.add("rooms_bedrooms");
    if (
      normalizeNum(effectiveForm.rooms_living) !==
      normalizeNum(initial.rooms_living)
    )
      includeKeys.add("rooms_living");
    strKeys.forEach((key) => {
      const k = key as keyof typeof form;
      if (normalizeStr(effectiveForm[k]) !== normalizeStr(initial[k])) {
        includeKeys.add(key);
      }
    });

    if (includeKeys.size === 0) {
      setSaving(false);
      setSuccess("");
      setError("No changes to save.");
      return;
    }

    const payload = buildPayload(effectiveForm, includeKeys);

    const res = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json?.error || "Failed to save changes.");
      setSaving(false);
      return;
    }

    setSuccess("Saved.");
    setTouched({});
    initialRef.current = { ...effectiveForm };
    const nextForm = effectiveForm;
    const lat = toNumberOrNull(String(nextForm.lat));
    const lng = toNumberOrNull(String(nextForm.lng));
    if (lat != null && lng != null) {
      window.dispatchEvent(
        new CustomEvent("listing:coords", {
          detail: { id: listing.id, lat, lng }
        })
      );
    }
    router.refresh();

    setSaving(false);
  }

  async function onDelete() {
    const confirmDelete = window.confirm(
      "Delete this listing? It will be removed from the site and excluded from future imports."
    );
    if (!confirmDelete) return;

    const reason = window.prompt("Optional reason (visible only to admins):") || null;

    setSaving(true);
    setError("");
    setSuccess("");
    const {
      data: { session }
    } = await supabaseBrowser.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("Not authenticated.");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/listings/${listing.id}/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json?.error || "Failed to delete listing.");
      setSaving(false);
      return;
    }

    setSuccess("Listing deleted.");
    setSaving(false);
    router.refresh();
  }

  if (adminStatus === "loading") return null;
  if (adminStatus === "not_admin") return null;

  return (
    <div className="ui-card-strong p-4 text-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Admin edit</span>
        <span className="text-[11px] text-slate-400">Listing ID {listing.id}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Price (USD)</span>
          <input
            className="ui-input"
            value={form.price_value}
            ref={(el) => {
              inputRefs.current.price_value = el;
            }}
            onChange={(e) => updateField("price_value", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Area m²</span>
          <input
            className="ui-input"
            value={form.area_m2}
            ref={(el) => {
              inputRefs.current.area_m2 = el;
            }}
            onChange={(e) => updateField("area_m2", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Floor</span>
          <input
            className="ui-input"
            value={form.floor}
            ref={(el) => {
              inputRefs.current.floor = el;
            }}
            onChange={(e) => updateField("floor", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Total floors</span>
          <input
            className="ui-input"
            value={form.total_floors}
            ref={(el) => {
              inputRefs.current.total_floors = el;
            }}
            onChange={(e) => updateField("total_floors", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Rooms</span>
          <select
            className="ui-select"
            value={form.rooms_text}
            ref={(el) => {
              inputRefs.current.rooms_text = el;
            }}
            onChange={(e) => updateField("rooms_text", e.target.value)}
          >
            {roomOptions.map((opt) => (
              <option key={opt.value || "any"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Condition</span>
          <select
            className="ui-select"
            value={form.condition_norm}
            ref={(el) => {
              inputRefs.current.condition_norm = el;
            }}
            onChange={(e) => updateField("condition_norm", e.target.value)}
          >
            {conditionOptions.map((opt) => (
              <option key={opt || "any"} value={opt}>
                {opt
                  ? opt
                      .toLowerCase()
                      .replace(/_/g, " ")
                      .replace(/^\w/, (c) => c.toUpperCase())
                  : "—"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">District</span>
          <input
            className="ui-input"
            value={form.district}
            ref={(el) => {
              inputRefs.current.district = el;
            }}
            onChange={(e) => updateField("district", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-slate-500">Property type</span>
          <select
            className="ui-select"
            value={form.property_type}
            ref={(el) => {
              inputRefs.current.property_type = el;
            }}
            onChange={(e) => updateField("property_type", e.target.value)}
          >
            {propertyTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-slate-500">Building name</span>
          <input
            className="ui-input"
            value={form.building_name}
            ref={(el) => {
              inputRefs.current.building_name = el;
            }}
            onChange={(e) => updateField("building_name", e.target.value)}
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-[11px] text-slate-500">Address text</span>
          <input
            className="ui-input"
            value={form.address_text}
            ref={(el) => {
              inputRefs.current.address_text = el;
            }}
            onChange={(e) => updateField("address_text", e.target.value)}
            onFocus={() => setEditedAddress(true)}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          />
        </label>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-slate-200/60 bg-white p-2 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Address suggestions</span>
            {searching && <span>Searching…</span>}
          </div>
          {suggestions.map((s) => (
            <button
              key={`${s.lat}-${s.lng}-${s.label}`}
              type="button"
              className="block w-full text-left rounded-lg px-2 py-1 hover:bg-slate-100"
              onClick={(e) => {
                e.preventDefault();
                suppressSuggestRef.current = true;
                const nextForm = {
                  ...form,
                  address_text: s.label,
                  lat: s.lat,
                  lng: s.lng
                };
                setTouched((prev) => ({
                  ...prev,
                  address_text: true,
                  lat: true,
                  lng: true
                }));
                setForm(nextForm);
                setSuggestions([]);
                setSearching(false);
                void onSave(nextForm, ["address_text", "lat", "lng"]);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          className="text-[11px] text-slate-600 hover:underline"
          onClick={() => {
            setShowCoords((v) => !v);
            if (!showCoords) {
              setManualCoords(true);
              setSuggestions([]);
            }
          }}
        >
          {showCoords ? "Hide coordinates" : "Add coordinates manually"}
        </button>
        {showCoords && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">Latitude</span>
              <input
                className="ui-input"
                value={form.lat}
                ref={(el) => {
                  inputRefs.current.lat = el;
                }}
                onChange={(e) => updateField("lat", e.target.value)}
                placeholder="41.628230"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-slate-500">Longitude</span>
              <input
                className="ui-input"
                value={form.lng}
                ref={(el) => {
                  inputRefs.current.lng = el;
                }}
                onChange={(e) => updateField("lng", e.target.value)}
                placeholder="41.609048"
              />
            </label>
            <div className="col-span-2 flex items-center gap-2">
              <button
                type="button"
                className="ui-button-ghost text-[11px]"
                onClick={() => pasteCoordsFromClipboard(false)}
              >
                Paste
              </button>
              <button
                type="button"
                className="ui-button-ghost text-[11px]"
                onClick={() => pasteCoordsFromClipboard(true)}
              >
                Paste & save
              </button>
              <span className="text-[11px] text-slate-400">
                Format: 41.628230, 41.609048
              </span>
            </div>
          </div>
        )}
      </div>

      <label className="space-y-1 block">
        <span className="text-[11px] text-slate-500">Description</span>
        <textarea
          className="ui-input min-h-[120px] font-mono text-[11px]"
          value={form.description_raw}
          ref={(el) => {
            inputRefs.current.description_raw = el;
          }}
          onChange={(e) => updateField("description_raw", e.target.value)}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="ui-button text-[11px] disabled:opacity-60"
          onClick={() => {
            void onSave();
          }}
          disabled={saving || !isDirty}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          className="ui-button-ghost text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
          onClick={onDelete}
          disabled={saving}
        >
          Delete listing
        </button>
        {error && <span className="text-[11px] text-rose-600">{error}</span>}
        {success && !error && (
          <span className="text-[11px] text-emerald-600">{success}</span>
        )}
      </div>
    </div>
  );
}
