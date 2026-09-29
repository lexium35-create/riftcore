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
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const identityEmail = user.identities
    ?.map((identity) => identity.identity_data?.email)
    .find((value): value is string => typeof value === "string" && value.includes("@"));
  const email = user.email ?? identityEmail;
  if (!email) return Response.json({ sent: false, reason: "no_email" });

  await sendRiftcoreMail({
    to: [email],
    subject: "Security notice — a Riftcore session was signed out",
    eyebrow: "RIFTCORE / SECURITY",
    title: "Session closed.",
    intro: "A signed-in Riftcore session for your account was closed.",
    lines: [
      "If you signed out yourself, there is nothing else to do.",
      "If this was unexpected, sign in again and review the platforms bound to your account.",
    ],
    facts: [
      { label: "Event", value: "Sign out" },
      { label: "Account status", value: "Still active" },
    ],
    nextSteps: [
      "Ignore this email if you signed out intentionally.",
      "If you did not, sign back in and review Bound Platforms in your profile.",
    ],
    cta: {
      label: "Review account",
      href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
    },
  });

  return Response.json({ sent: true });
}
