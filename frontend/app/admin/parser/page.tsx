"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";

type SyncMode = "incremental" | "backfill" | "check_deleted";

export default function AdminParserPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMode, setSyncMode] = useState<string | null>(null);
  const [syncStartedAt, setSyncStartedAt] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

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
  }

  useEffect(() => {
    if (!accessToken) {
      setIsAdmin(null);
      setSyncRunning(false);
      setSyncMode(null);
      setSyncStartedAt(null);
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

  async function runSync(mode: SyncMode) {
    if (!accessToken) {
      setSyncMessage("Требуется авторизация.");
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
      setSyncMessage(json?.error || "Не удалось запустить парсер.");
      setSyncBusy(false);
      return;
    }

    setSyncRunning(true);
    setSyncMode(json.mode ?? mode);
    setSyncStartedAt(json.startedAt ?? null);
    setSyncMessage(
      mode === "check_deleted"
        ? "Проверка старых объявлений запущена в фоне."
        : mode === "backfill"
        ? "Полная синхронизация запущена в фоне."
        : "Инкрементальная синхронизация запущена в фоне."
    );
    setSyncBusy(false);
    await fetchSyncStatus(accessToken);
  }

  if (!accessToken) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm text-sm text-slate-600">
        Войдите на <a className="text-blue-700 hover:underline" href="/admin">/admin</a>.
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm text-sm text-slate-600">
        У этого аккаунта нет прав администратора.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Парсер Telegram</h2>
        <p className="text-xs text-slate-500">
          Запуск парсера с сайта. Он работает в фоне на сервере.
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
          {syncBusy ? "Запуск..." : "Запустить инкрементальную синхронизацию"}
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          onClick={() => {
            void runSync("check_deleted");
          }}
          disabled={syncBusy || syncRunning}
        >
          Проверить старые объявления
        </button>
      </div>

      <div className="text-xs text-slate-600 space-y-1">
        <div>Статус: {syncRunning ? "выполняется" : "ожидание"}</div>
        {syncMode && <div>Режим: {syncMode}</div>}
        {syncStartedAt && <div>Запущено: {new Date(syncStartedAt).toLocaleString()}</div>}
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
    </div>
  );
}
