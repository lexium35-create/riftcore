import { getRiftcoreSupabaseForToken } from "@/lib/supabase";
import { sendRiftcoreMail } from "@/lib/mail";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

export async function POST(request: Request) {
  const accessToken = bearer(request);
  if (!accessToken) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getRiftcoreSupabaseForToken(accessToken);
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("welcome_email_sent_at,display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.welcome_email_sent_at) return Response.json({ sent: false, reason: "already_sent" });

  const identityEmail = user.identities
    ?.map((identity) => identity.identity_data?.email)
    .find((value): value is string => typeof value === "string" && value.includes("@"));
  const email = user.email ?? identityEmail;
  if (!email) return Response.json({ sent: false, reason: "no_email" });

  const name =
    profile?.display_name ??
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    "player";

  await sendRiftcoreMail({
    to: [email],
    subject: `Welcome to Riftcore, ${name}`,
    eyebrow: "RIFTCORE / ACCOUNT CREATED",
    title: "Your Riftcore identity is live.",
    intro: `Welcome, ${name}. Your account is now the identity behind your tournament activity.`,
    lines: [
      "Registrations you submit will stay attached to this account across future tournaments.",
      "You can also bind Telegram, Google, Discord and GitHub so multiple sign-in methods resolve to the same Riftcore identity.",
    ],
    facts: [
      { label: "Account", value: "Active" },
      { label: "Tournament history", value: "Enabled" },
      { label: "Bound platforms", value: "Available in profile" },
    ],
    nextSteps: [
      "Set the display name you want shown on Riftcore.",
      "Bind any other platforms you want to use for sign-in.",
      "Join the official community so match-day updates do not get missed.",
    ],
    cta: {
      label: "Open your profile",
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
    },
    secondaryCta: {
      label: "Join the community",
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/community`,
    },
  });

  await supabase
    .from("user_profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return Response.json({ sent: true });
}
