"use client";

import { useEffect, useMemo, useState } from "react";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";

type NavIdentity = {
  signedIn: boolean;
  label: string;
  avatar: string | null;
};

export default function AccountNavAction() {
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [identity, setIdentity] = useState<NavIdentity>({
    signedIn: false,
    label: "Sign in",
    avatar: null,
  });

  useEffect(() => {
    function apply(user: any | null) {
      if (!user) {
        setIdentity({ signedIn: false, label: "Sign in", avatar: null });
        return;
      }

      const metadata = user.user_metadata ?? {};
      const label =
        metadata.display_name ??
        metadata.full_name ??
        metadata.name ??
        metadata.preferred_username ??
        user.email ??
        "Profile";
      const avatar = metadata.avatar_url ?? metadata.picture ?? null;
      setIdentity({ signedIn: true, label: String(label), avatar });
    }

    void supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  if (!identity.signedIn) {
    return <a className="navOps" href="/login">Sign in</a>;
  }

  return (
    <a className="accountNavAction" href="/account" aria-label="Open profile">
      {identity.avatar ? (
        <img className="accountNavAvatar" src={identity.avatar} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="accountNavAvatar accountNavInitial">{identity.label.slice(0, 1).toUpperCase()}</span>
      )}
      <span className="accountNavCopy">
        <small>PROFILE</small>
        <strong>{identity.label}</strong>
      </span>
    </a>
  );
}
