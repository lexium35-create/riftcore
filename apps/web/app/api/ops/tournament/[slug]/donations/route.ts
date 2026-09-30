import { getRiftcoreSupabaseForToken } from "@/lib/supabase";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const token = bearer(request);
  if (!token) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        amountInr?: number;
        donorName?: string;
        note?: string;
        paymentReference?: string;
      }
    | null;

  if (!Number.isInteger(body?.amountInr) || (body?.amountInr ?? 0) <= 0) {
    return Response.json({ error: "A valid donation amount is required." }, { status: 400 });
  }

  const supabase = getRiftcoreSupabaseForToken(token);
  const { data, error } = await supabase.rpc("record_tournament_donation", {
    p_tournament_slug: slug,
    p_amount_inr: body?.amountInr,
    p_donor_name: body?.donorName ?? null,
    p_note: body?.note ?? null,
    p_payment_reference: body?.paymentReference ?? null,
  });

  if (error) return Response.json({ error: error.message }, { status: 409 });
  return Response.json(data);
}
