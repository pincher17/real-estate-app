import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason : null;

  const { data: listing, error: listingError } = await adminClient
    .from("listings")
    .select("id, source_id, listing_key, message_id, permalink")
    .eq("id", resolvedParams.id)
    .maybeSingle();

  if (listingError || !listing) {
    return NextResponse.json(
      { error: listingError?.message || "Listing not found" },
      { status: 404 }
    );
  }

  await adminClient.from("excluded_listings").upsert(
    {
      source_id: listing.source_id,
      listing_key: listing.listing_key,
      message_id: listing.message_id,
      permalink: listing.permalink,
      reason,
      deleted_by: userData.user.id
    },
    { onConflict: "source_id,listing_key" }
  );

  const { data: images } = await adminClient
    .from("listing_images")
    .select("telegram_media_id")
    .eq("listing_id", listing.id);

  const mediaIds = (images || [])
    .map((row) => row.telegram_media_id)
    .filter(Boolean) as string[];

  if (mediaIds.length) {
    const { data: mediaRows } = await adminClient
      .from("telegram_media")
      .select("id, storage_bucket, storage_path")
      .in("id", mediaIds);

    if (mediaRows && mediaRows.length) {
      const byBucket = new Map<string, string[]>();
      for (const row of mediaRows as any[]) {
        if (!row.storage_bucket || !row.storage_path) continue;
        const paths = byBucket.get(row.storage_bucket) || [];
        paths.push(row.storage_path);
        byBucket.set(row.storage_bucket, paths);
      }

      for (const [bucket, paths] of byBucket.entries()) {
        if (paths.length) {
          await adminClient.storage.from(bucket).remove(paths);
        }
      }
    }

    await adminClient.from("listing_images").delete().eq("listing_id", listing.id);
    await adminClient.from("telegram_media").delete().in("id", mediaIds);
  }

  await adminClient.from("listings").delete().eq("id", listing.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
