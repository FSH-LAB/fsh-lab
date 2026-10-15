import { ACTIVE_INCIDENTS, PAST_INCIDENTS } from "@/lib/incidents";
import { optionsResponse, problemResponse, restJsonResponse } from "@/lib/rest";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const incidents = [...ACTIVE_INCIDENTS, ...PAST_INCIDENTS];
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return problemResponse(
      404,
      "Incident Not Found",
      `The requested incident with identifier '${id}' was not found.`,
      new URL(request.url).pathname,
    );
  }

  return restJsonResponse(
    {
      data: incident,
    },
    request,
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
