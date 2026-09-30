import { getRiftcoreSupabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const supabase = getRiftcoreSupabase();
  const { data, error } = await supabase.rpc("get_public_tournament_announcements", {
    p_tournament_slug: slug,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ announcements: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
