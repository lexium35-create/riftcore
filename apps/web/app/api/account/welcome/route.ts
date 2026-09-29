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
    subject: "Welcome to Riftcore",
    eyebrow: "RIFTCORE / ACCOUNT",
    title: "Your Riftcore identity is live.",
    lines: [
      `Welcome, ${name}.`,
      "Your account can follow tournament registrations, receive status updates and bind additional sign-in platforms from the profile page.",
    ],
    cta: {
      label: "Open your profile",
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
    },
  });

  await supabase
    .from("user_profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return Response.json({ sent: true });
}
