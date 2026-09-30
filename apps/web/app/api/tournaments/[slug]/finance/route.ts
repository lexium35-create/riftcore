import { getRiftcoreSupabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const supabase = getRiftcoreSupabase();
  const { data, error } = await supabase.rpc("get_public_tournament_finance", {
    p_tournament_slug: slug,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Tournament finance configuration not found." }, { status: 404 });
  }

  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
