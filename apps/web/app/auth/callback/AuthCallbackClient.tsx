"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

function friendlyAuthError(message: string): string {
  if (message.toLowerCase().includes("user email from external provider")) {
    return "Telegram sign-in reached Riftcore but the provider callback could not complete. Retry from the login page; if it persists, tournament support can trace the Auth request.";
  }

  return message;
}

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [message, setMessage] = useState("Completing authentication…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const errorDescription = searchParams.get("error_description");
      const errorCode = searchParams.get("error");

      if (errorDescription || errorCode) {
        const raw = errorDescription || errorCode || "Authentication failed.";
        setFailed(true);
        setMessage(friendlyAuthError(raw));
        return;
      }

      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            setFailed(true);
            setMessage(friendlyAuthError(error.message));
          }
          return;
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setFailed(true);
            setMessage("No authenticated session was returned.");
          }
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch("/api/account/welcome", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => null);
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
    <div style={{ maxWidth: 560 }}>
      <p
        style={{
          color: "#b5ff63",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.18em",
        }}
      >
        RIFTCORE / AUTH
      </p>

      <h1 style={{ margin: "12px 0", fontSize: 42 }}>
        {failed ? "Sign-in interrupted." : "Securing session."}
      </h1>

      <p style={{ color: "#97a5a9", lineHeight: 1.6 }}>{message}</p>

      {failed && (
        <a
          href="/login"
          style={{
            display: "inline-flex",
            marginTop: 20,
            color: "#b5ff63",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          ← Back to sign in
        </a>
      )}
    </div>
  );
}
