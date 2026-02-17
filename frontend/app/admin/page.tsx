"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMode, setSyncMode] = useState<string | null>(null);
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncLogTail, setSyncLogTail] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();
      if (!mounted) return;
      setAccessToken(session?.access_token ?? null);
    })();

    const {
      data: { subscription }
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchSyncStatus(token: string) {
    const res = await fetch("/api/admin/telegram-sync", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setSyncRunning(Boolean(json.running));
    setSyncMode(json.mode ?? null);
    setSyncStartedAt(json.startedAt ?? null);
    setSyncLogTail(json.logTail ?? "");
  }

  useEffect(() => {
    if (!accessToken) {
      setIsAdmin(null);
      setSyncRunning(false);
      setSyncMode(null);
      setSyncStartedAt(null);
      setSyncLogTail("");
      return;
    }
    (async () => {
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const json = await res.json().catch(() => ({}));
      const nextIsAdmin = Boolean(json?.isAdmin);
      setIsAdmin(nextIsAdmin);
      if (nextIsAdmin) {
        await fetchSyncStatus(accessToken);
      }
    })();
    const timer = setInterval(() => {
      if (isAdmin) {
        void fetchSyncStatus(accessToken);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [accessToken, isAdmin]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Signed in.");
  }

  async function runSync(mode: "incremental" | "backfill" | "check_deleted") {
    if (!accessToken) {
      setSyncMessage("Not authenticated.");
      return;
    }
    setSyncBusy(true);
    setSyncMessage("");

    const res = await fetch("/api/admin/telegram-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ mode })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSyncMessage(json?.error || "Failed to start parser.");
      setSyncBusy(false);
      return;
    }

    setSyncRunning(true);
    setSyncMode(json.mode ?? mode);
    setSyncStartedAt(json.startedAt ?? null);
    setSyncMessage(
      mode === "backfill"
        ? "Backfill started in background."
        : mode === "check_deleted"
        ? "Old listings check started in background."
        : "Incremental sync started in background."
    );
    setSyncBusy(false);
    await fetchSyncStatus(accessToken);
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Admin Sign In</h2>
        <p className="text-xs text-slate-500">
          Sign in with your admin account to edit listings and run Telegram sync.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
            required
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {message && (
        <div
          className={`text-xs ${
            status === "error" ? "text-rose-600" : "text-emerald-700"
          }`}
        >
          {message}
        </div>
      )}

      {accessToken && isAdmin === true && (
        <div className="rounded-lg border border-slate-200 p-3 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-800">Telegram parser</h3>
            <p className="text-xs text-slate-500">
              Start parser from website. It runs in background on server.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                void runSync("incremental");
              }}
              disabled={syncBusy || syncRunning}
            >
              {syncBusy ? "Starting..." : "Run incremental sync"}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => {
                void runSync("check_deleted");
              }}
              disabled={syncBusy || syncRunning}
            >
              Check old listings
            </button>
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <div>Status: {syncRunning ? "running" : "idle"}</div>
            {syncMode && <div>Mode: {syncMode}</div>}
            {syncStartedAt && (
              <div>Started: {new Date(syncStartedAt).toLocaleString()}</div>
            )}
          </div>

          {syncMessage && (
            <div
              className={`text-xs ${
                syncMessage.toLowerCase().includes("fail") ||
                syncMessage.toLowerCase().includes("error")
                  ? "text-rose-600"
                  : "text-emerald-700"
              }`}
            >
              {syncMessage}
            </div>
          )}

          {syncLogTail && (
            <pre className="max-h-52 overflow-auto rounded-md bg-slate-950 p-2 text-[11px] text-slate-100">
              {syncLogTail}
            </pre>
          )}
        </div>
      )}

      {accessToken && isAdmin === false && (
        <div className="text-xs text-slate-500">
          This account is signed in, but has no admin access.
        </div>
      )}
    </div>
  );
}
