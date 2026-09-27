"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/ops";
  }

  return value;
}

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [message, setMessage] = useState("Completing authentication…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const errorDescription = searchParams.get("error_description");
      const errorCode = searchParams.get("error");

      if (errorDescription || errorCode) {
        setMessage(errorDescription || errorCode || "Authentication failed.");
        return;
      }

      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) setMessage(error.message);
          return;
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setMessage("No authenticated session was returned.");
          }
          return;
        }
      }

      if (!cancelled) {
        router.replace(safeNext(searchParams.get("next")));
        router.refresh();
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams, supabase]);

  return (
    <div style={{ maxWidth: 520 }}>
      <p
        style={{
          color: "#82ffc4",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.18em",
        }}
      >
        RIFTCORE / AUTH
      </p>
      <h1 style={{ margin: "12px 0", fontSize: 42 }}>
        Securing session.
      </h1>
      <p style={{ color: "#97a5a9", lineHeight: 1.6 }}>{message}</p>
    </div>
  );
}
