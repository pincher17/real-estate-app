import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncMode = "incremental" | "backfill" | "check_deleted";

function parseBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

async function assertAdmin(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Server auth not configured" },
        { status: 500 }
      )
    };
  }

  const token = parseBearerToken(request);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: userError?.message || "Unauthorized" },
        { status: 401 }
      )
    };
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id, is_admin")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow?.is_admin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: adminError?.message || "Forbidden" },
        { status: 403 }
      )
    };
  }

  return { ok: true as const };
}
function getRemoteConfig() {
  const baseUrl = (process.env.TELEGRAM_SYNC_SERVER_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.TELEGRAM_SYNC_SERVER_TOKEN || "").trim();
  return { baseUrl, token };
}

export async function GET(request: Request) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;

  const { baseUrl, token } = getRemoteConfig();
  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "Remote sync server is not configured" },
      { status: 500 }
    );
  }

  try {
    const upstream = await fetch(`${baseUrl}/sync/status`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Remote sync server is unreachable",
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await assertAdmin(request);
  if (!auth.ok) return auth.response;

  const { baseUrl, token } = getRemoteConfig();
  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "Remote sync server is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode: SyncMode =
    body?.mode === "backfill"
      ? "backfill"
      : body?.mode === "check_deleted"
      ? "check_deleted"
      : "incremental";
  try {
    const upstream = await fetch(`${baseUrl}/sync/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ mode }),
      cache: "no-store"
    });

    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Remote sync server is unreachable",
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 502 }
    );
  }
}
