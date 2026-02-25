"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();
      if (mounted) {
        setHasSession(Boolean(session?.access_token));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
    setHasSession(true);
    setMessage("Вход выполнен.");
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Вход администратора</h2>
        <p className="text-xs text-slate-500">
          Войдите в аккаунт администратора, чтобы редактировать объявления и управлять парсером.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Почта</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Пароль</label>
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
          {status === "loading" ? "Входим..." : "Войти"}
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

      {hasSession && (
        <div className="text-xs text-slate-600">
          Страница управления парсером:{" "}
          <Link href="/admin/parser" className="text-blue-700 hover:underline">
            /admin/parser
          </Link>
        </div>
      )}
    </div>
  );
}
