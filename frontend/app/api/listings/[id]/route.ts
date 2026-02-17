import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type UpdatePayload = {
  price_value?: number | null;
  price_currency?: string | null;
  price_usd?: number | null;
  area_m2?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  rooms_text?: string | null;
  rooms_bedrooms?: number | null;
  rooms_living?: number | null;
  condition_norm?: string | null;
  district?: string | null;
  street?: string | null;
  building_name?: string | null;
  address_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  description_raw?: string | null;
  property_type?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server auth not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } =
    await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json(
      { error: userError?.message || "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id, is_admin")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow?.is_admin) {
    return NextResponse.json(
      { error: adminError?.message || "Forbidden" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as UpdatePayload;
  console.log("[api/listings] incoming body", body);

  const updates: UpdatePayload = {};
  const has = (key: keyof UpdatePayload) =>
    Object.prototype.hasOwnProperty.call(body, key);

  if (has("price_value")) updates.price_value = body.price_value ?? null;
  if (has("price_currency")) updates.price_currency = body.price_currency ?? null;
  if (has("price_usd")) updates.price_usd = body.price_usd ?? null;
  if (has("area_m2")) updates.area_m2 = body.area_m2 ?? null;
  if (has("floor")) updates.floor = body.floor ?? null;
  if (has("total_floors")) updates.total_floors = body.total_floors ?? null;
  if (has("rooms_text")) updates.rooms_text = body.rooms_text ?? null;
  if (has("rooms_bedrooms"))
    updates.rooms_bedrooms = body.rooms_bedrooms ?? null;
  if (has("rooms_living")) updates.rooms_living = body.rooms_living ?? null;
  if (has("condition_norm")) updates.condition_norm = body.condition_norm ?? null;
  if (has("district")) updates.district = body.district ?? null;
  if (has("street")) updates.street = body.street ?? null;
  if (has("building_name")) updates.building_name = body.building_name ?? null;
  if (has("address_text")) updates.address_text = body.address_text ?? null;
  if (has("lat")) updates.lat = body.lat ?? null;
  if (has("lng")) updates.lng = body.lng ?? null;
  if (has("description_raw"))
    updates.description_raw = body.description_raw ?? null;
  if (has("property_type"))
    updates.property_type = body.property_type ?? "apartment";

  if (has("price_value")) {
    if (updates.price_value != null) {
      updates.price_currency = "USD";
      updates.price_usd = updates.price_value;
    } else {
      updates.price_currency = null;
      updates.price_usd = null;
    }
  }
  console.log("[api/listings] updates", updates);

  const { data, error } = await adminClient
    .from("listings")
    .update(updates)
    .eq("id", resolvedParams.id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[api/listings] update error", {
      id: resolvedParams.id,
      error
    });
    return NextResponse.json(
      { error: error?.message || "Update failed" },
      { status: 500 }
    );
  }

  if (!data) {
    console.warn("[api/listings] update returned no rows", {
      id: resolvedParams.id,
      updates
    });
    return NextResponse.json(
      { error: "Update failed: listing not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, listing: data }, { status: 200 });
}
