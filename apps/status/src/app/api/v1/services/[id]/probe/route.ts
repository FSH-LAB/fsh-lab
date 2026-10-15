import { getProbeSnapshot, isAuthorizedToForce } from "@/lib/probe";
import { optionsResponse, problemResponse, restJsonResponse } from "@/lib/rest";
import { MONITORED_SERVICES_CONFIG } from "@/lib/services";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const exists = MONITORED_SERVICES_CONFIG.some((s) => s.id === id);

  if (!exists) {
    return problemResponse(
      404,
      "Service Not Found",
      `Cannot execute probe. Service with identifier '${id}' is not registered.`,
      new URL(request.url).pathname,
    );
  }

  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "true" && isAuthorizedToForce(request);

  const snapshot = await getProbeSnapshot({ force });
  const probe = snapshot[id];

  return restJsonResponse(
    {
      data: probe,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    request,
    { maxAge: 5, staleWhileRevalidate: 15 },
  );
}

export async function HEAD(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  return GET(request, props);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
