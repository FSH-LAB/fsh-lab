import { getProbeSnapshot } from "@/lib/probe";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetId = url.searchParams.get("id") ?? undefined;
  const force = url.searchParams.get("force") === "true";

  const results = await getProbeSnapshot({ targetId, force });

  return Response.json(
    {
      timestamp: new Date().toISOString(),
      results,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
