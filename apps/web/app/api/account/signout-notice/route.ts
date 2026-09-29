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
    subject: "Signed out of Riftcore",
    eyebrow: "RIFTCORE / SECURITY",
    title: "Session signed out.",
    lines: [
      "A Riftcore session for your account was signed out.",
      "If this was you, no action is needed. If it was unexpected, sign in again and review your linked platforms.",
    ],
    cta: {
      label: "Open Riftcore",
      href: process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app",
    },
  });

  return Response.json({ sent: true });
}
