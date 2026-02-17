"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function FooterAdminParserLink() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session }
      } = await supabaseBrowser.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        if (active) {
          setIsAdmin(false);
          setChecked(true);
        }
        return;
      }

      try {
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json().catch(() => ({}));
        if (active) {
          setIsAdmin(Boolean(json?.isAdmin));
          setChecked(true);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setChecked(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!checked || !isAdmin) return null;

  return (
    <Link href="/admin/parser" className="text-blue-700 hover:underline">
      Parser
    </Link>
  );
}
