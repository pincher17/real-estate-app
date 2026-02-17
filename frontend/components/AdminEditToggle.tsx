"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function AdminEditToggle({
  children
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        if (mounted) {
          setIsAdmin(false);
          setChecked(true);
        }
        return;
      }

      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json().catch(() => ({}));
      if (mounted) {
        setIsAdmin(Boolean(json.isAdmin));
        setChecked(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!checked || !isAdmin) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="ui-button-ghost text-[11px]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide admin edit" : "Show admin edit"}
      </button>
      {open ? children : null}
    </div>
  );
}
