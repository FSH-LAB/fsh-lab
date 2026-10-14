import { describe, expect, it } from "vitest";
import {
  GET as getFeed,
  OPTIONS as optionsFeed,
} from "@/app/api/v1/feed/route";
import {
  GET as getIncidents,
  OPTIONS as optionsIncidents,
} from "@/app/api/v1/incidents/route";
import {
  GET as getIncidentById,
  OPTIONS as optionsIncidentById,
} from "@/app/api/v1/incidents/[id]/route";
import {
  GET as getServices,
  OPTIONS as optionsServices,
} from "@/app/api/v1/services/route";
import {
  GET as getServiceById,
  OPTIONS as optionsServiceById,
} from "@/app/api/v1/services/[id]/route";
import {
  GET as getServiceProbe,
  OPTIONS as optionsServiceProbe,
} from "@/app/api/v1/services/[id]/probe/route";
import {
  GET as getStatus,
  HEAD as headStatus,
  OPTIONS as optionsStatus,
} from "@/app/api/v1/status/route";
import { MONITORED_SERVICES_CONFIG } from "@/lib/services";

describe("RESTful API standards and routes", () => {
  it("GET /api/v1/status returns 200 with standard payload and ETag", async () => {
    const req = new Request("http://localhost:3000/api/v1/status");
    const res = await getStatus(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");

    const etag = res.headers.get("ETag");
    expect(etag).toBeTruthy();

    const body = await res.json();
    expect(body.page.id).toBe("fsh-lab-status");
    expect(body.status.indicator).toBeDefined();
    expect(Array.isArray(body.services)).toBe(true);

    // Conditional request with If-None-Match returns 304 Not Modified
    const condReq = new Request("http://localhost:3000/api/v1/status", {
      headers: { "If-None-Match": etag! },
    });
    const condRes = await getStatus(condReq);
    expect(condRes.status).toBe(304);
  });

  it("HEAD /api/v1/status returns 200 with headers but empty body", async () => {
    const req = new Request("http://localhost:3000/api/v1/status", {
      method: "HEAD",
    });
    const res = await headStatus(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
    const text = await res.text();
    expect(text).toBe("");
  });

  it("OPTIONS /api/v1/status returns 204 with Allow header", async () => {
    const res = await optionsStatus();
    expect(res.status).toBe(204);
    expect(res.headers.get("Allow")).toContain("GET");
    expect(res.headers.get("Allow")).toContain("HEAD");
    expect(res.headers.get("Allow")).toContain("OPTIONS");
  });

  it("GET /api/v1/services returns collection of services", async () => {
    const req = new Request("http://localhost:3000/api/v1/services");
    const res = await getServices(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBeGreaterThanOrEqual(1);

    const optRes = await optionsServices();
    expect(optRes.status).toBe(204);
  });

  it("GET /api/v1/services/[id] returns single service or RFC 7807 problem details on 404", async () => {
    const target = MONITORED_SERVICES_CONFIG[0]!;
    // Valid service
    const req = new Request(
      `http://localhost:3000/api/v1/services/${target.id}`,
    );
    const res = await getServiceById(req, {
      params: Promise.resolve({ id: target.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(target.id);

    // Invalid service
    const notFoundReq = new Request(
      "http://localhost:3000/api/v1/services/unknown-service",
    );
    const notFoundRes = await getServiceById(notFoundReq, {
      params: Promise.resolve({ id: "unknown-service" }),
    });

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.headers.get("Content-Type")).toContain(
      "application/problem+json",
    );
    const problem = await notFoundRes.json();
    expect(problem.title).toBe("Service Not Found");
    expect(problem.status).toBe(404);

    const optRes = await optionsServiceById();
    expect(optRes.status).toBe(204);
  });

  it("GET /api/v1/services/[id]/probe returns probe data or 404 problem details", async () => {
    const target = MONITORED_SERVICES_CONFIG[0]!;
    const req = new Request(
      `http://localhost:3000/api/v1/services/${target.id}/probe`,
    );
    const res = await getServiceProbe(req, {
      params: Promise.resolve({ id: target.id }),
    });

    expect(res.status).toBe(200);

    const notFoundReq = new Request(
      "http://localhost:3000/api/v1/services/unknown/probe",
    );
    const notFoundRes = await getServiceProbe(notFoundReq, {
      params: Promise.resolve({ id: "unknown" }),
    });

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.headers.get("Content-Type")).toContain(
      "application/problem+json",
    );

    const optRes = await optionsServiceProbe();
    expect(optRes.status).toBe(204);
  });

  it("GET /api/v1/incidents returns incidents collection and supports filtering", async () => {
    const req = new Request("http://localhost:3000/api/v1/incidents");
    const res = await getIncidents(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();

    const optRes = await optionsIncidents();
    expect(optRes.status).toBe(204);
  });

  it("GET /api/v1/incidents/[id] returns RFC 7807 404 when not found", async () => {
    const req = new Request("http://localhost:3000/api/v1/incidents/inc-404");
    const res = await getIncidentById(req, {
      params: Promise.resolve({ id: "inc-404" }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain(
      "application/problem+json",
    );
    const problem = await res.json();
    expect(problem.title).toBe("Incident Not Found");

    const optRes = await optionsIncidentById();
    expect(optRes.status).toBe(204);
  });

  it("GET /api/v1/feed returns valid Atom XML syndication feed", async () => {
    const res = getFeed(new Request("http://localhost:3000/api/v1/feed"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/atom+xml; charset=utf-8",
    );
    const xml = await res.text();
    expect(xml).toContain("<feed xmlns=");
    expect(xml).toContain("FSH Lab Status Updates");

    const optRes = optionsFeed();
    expect(optRes.status).toBe(204);
  });
});
