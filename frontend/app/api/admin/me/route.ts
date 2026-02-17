import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
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
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } =
    await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id, is_admin")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow?.is_admin) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  return NextResponse.json({ isAdmin: true }, { status: 200 });
}
