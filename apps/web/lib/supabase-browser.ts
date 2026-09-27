"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL =
  "https://mmmfpfnuqqqqfcdqpgvq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_8EtlG4GFFyfpqWaCym-z4w_kgdu4KIq";

let browserClient: SupabaseClient | null = null;

export function getRiftcoreBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  browserClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    global: {
      headers: {
        "X-Client-Info": "riftcore-operator-web",
      },
    },
  });

  return browserClient;
}
