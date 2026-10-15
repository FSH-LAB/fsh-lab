import { getProbeSnapshot, isAuthorizedToForce } from "@/lib/probe";
import { optionsResponse, restJsonResponse } from "@/lib/rest";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetId = url.searchParams.get("id") ?? undefined;
  const force =
    url.searchParams.get("force") === "true" && isAuthorizedToForce(request);

  const snapshot = await getProbeSnapshot({ force });
  const results = targetId
    ? snapshot[targetId]
      ? { [targetId]: snapshot[targetId] }
      : {}
    : snapshot;

  return restJsonResponse(
    {
      data: {
        results,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    request,
    { maxAge: 5, staleWhileRevalidate: 15 },
  );
}

export async function HEAD(request: Request) {
  return GET(request);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
