import crypto from "node:crypto";

/**
 * Standard RFC 7807 / RFC 9457 Problem Details schema for RESTful error responses.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

const DEFAULT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, If-None-Match",
};

/**
 * Creates an RFC 7807 compliant error response.
 */
export function problemResponse(
  status: number,
  title: string,
  detail: string,
  instance?: string,
): Response {
  const problem: ProblemDetails = {
    type: `https://status.fsh-lab.dev/problems/${status}`,
    title,
    status,
    detail,
    instance,
  };

  return new Response(JSON.stringify(problem, null, 2), {
    status,
    headers: {
      "Content-Type": "application/problem+json; charset=utf-8",
      ...DEFAULT_CORS_HEADERS,
    },
  });
}

/**
 * Handles HTTP OPTIONS requests returning the standard Allow header and CORS headers.
 */
export function optionsResponse(
  allowedMethods: string[] = ["GET", "HEAD", "OPTIONS"],
): Response {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: allowedMethods.join(", "),
      ...DEFAULT_CORS_HEADERS,
    },
  });
}

/**
 * Creates an HTTP 405 Method Not Allowed response with the required Allow header.
 */
export function methodNotAllowedResponse(
  allowedMethods: string[] = ["GET", "HEAD", "OPTIONS"],
): Response {
  return new Response(
    JSON.stringify({
      type: "https://status.fsh-lab.dev/problems/405",
      title: "Method Not Allowed",
      status: 405,
      detail: `This resource only supports ${allowedMethods.join(", ")}.`,
    }),
    {
      status: 405,
      headers: {
        Allow: allowedMethods.join(", "),
        "Content-Type": "application/problem+json; charset=utf-8",
        ...DEFAULT_CORS_HEADERS,
      },
    },
  );
}

/**
 * Creates a standard RESTful JSON response with ETag, caching, and conditional request handling.
 */
export function restJsonResponse(
  data: unknown,
  request?: Request,
  options?: {
    status?: number;
    maxAge?: number;
    staleWhileRevalidate?: number;
  },
): Response {
  const status = options?.status ?? 200;
  const maxAge = options?.maxAge ?? 10;
  const staleWhileRevalidate = options?.staleWhileRevalidate ?? 30;

  const bodyJson = JSON.stringify(data, null, 2);
  const etag = `"${crypto.createHash("sha256").update(bodyJson).digest("hex").slice(0, 16)}"`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    ETag: etag,
    ...DEFAULT_CORS_HEADERS,
  };

  // Evaluate conditional If-None-Match request
  if (request) {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === "*")) {
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    // Support HTTP HEAD requests
    if (request.method === "HEAD") {
      return new Response(null, {
        status,
        headers,
      });
    }
  }

  return new Response(bodyJson, {
    status,
    headers,
  });
}
