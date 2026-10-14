import { ACTIVE_INCIDENTS, PAST_INCIDENTS } from "@/lib/incidents";
import { optionsResponse, restJsonResponse } from "@/lib/rest";
import type { Incident } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  let incidents: Incident[] = [...ACTIVE_INCIDENTS, ...PAST_INCIDENTS];

  if (statusFilter === "active") {
    incidents = ACTIVE_INCIDENTS;
  } else if (statusFilter === "resolved") {
    incidents = PAST_INCIDENTS;
  }

  return restJsonResponse(
    {
      data: incidents,
      meta: {
        total: incidents.length,
        active_count: ACTIVE_INCIDENTS.length,
        resolved_count: PAST_INCIDENTS.length,
        timestamp: new Date().toISOString(),
      },
    },
    request,
  );
}

export async function HEAD(request: Request) {
  return GET(request);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
