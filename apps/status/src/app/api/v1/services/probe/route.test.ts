import { beforeAll, describe, expect, it } from "vitest";
import {
  getProbeSnapshot,
  getServiceTelemetry,
  isAuthorizedToForce,
  resetProbeCacheForTesting,
} from "@/lib/probe";
import { registerService } from "@/lib/services";
import { GET, HEAD, OPTIONS } from "./route";

describe("probe route and engine", () => {
  const TEST_SERVICE_ID = "mock-probe-service";

  beforeAll(() => {
    // Register an isolated test fixture so tests never depend on specific production apps
    registerService({
      id: TEST_SERVICE_ID,
      name: "Mock Probe Test Service",
      category: "internal",
      description: "Test mock service for probe engine tests",
      healthEndpoint: "http://localhost:3000/api/health",
      targetUptime: 99.99,
      baseLatencyMs: 0,
      varianceMs: 0,
      probeType: "http_probe",
    });
  });

  it("classifies fast 2xx responses as operational", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]).toBeDefined();
    expect(results[TEST_SERVICE_ID]?.status).toBe("operational");
    expect(results[TEST_SERVICE_ID]?.statusCode).toBe(200);
    expect(results[TEST_SERVICE_ID]?.probeType).toBe("http_probe");
  });

  it("classifies 5xx server errors as major outage", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("major_outage");
    expect(results[TEST_SERVICE_ID]?.statusCode).toBe(502);
  });

  it("classifies 4xx errors as degraded performance", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response("Not Found", {
        status: 404,
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("degraded_performance");
    expect(results[TEST_SERVICE_ID]?.statusCode).toBe(404);
  });

  it("classifies network connection failure as major outage", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () => {
      throw new Error("connect ECONNREFUSED");
    };

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("major_outage");
    expect(results[TEST_SERVICE_ID]?.error).toBe("connect ECONNREFUSED");
  });

  it("classifies timeout errors as major outage", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () => {
      const err = new Error("The operation timed out");
      err.name = "TimeoutError";
      throw err;
    };

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("major_outage");
  });

  it("classifies response with ready: false as major outage", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ status: "ok", ready: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("major_outage");
    expect(results[TEST_SERVICE_ID]?.error).toContain("ready=false");
  });

  it("classifies response with degraded status as degraded performance", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ status: "degraded", ready: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]?.status).toBe("degraded_performance");
  });

  it("probes service health endpoint and records telemetry points", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ status: "ok", ready: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: TEST_SERVICE_ID,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results[TEST_SERVICE_ID]).toBeDefined();
    expect(results[TEST_SERVICE_ID]?.status).toBe("operational");
    expect(results[TEST_SERVICE_ID]?.probeType).toBe("http_probe");

    const telemetry = getServiceTelemetry(TEST_SERVICE_ID);
    expect(telemetry.points.length).toBeGreaterThanOrEqual(1);
  });

  it("handles RESTful GET and OPTIONS requests on route", async () => {
    resetProbeCacheForTesting();
    const request = new Request(
      `http://localhost:3000/api/v1/services/probe?id=${TEST_SERVICE_ID}`,
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.results[TEST_SERVICE_ID]).toBeDefined();

    const optionsRes = await OPTIONS();
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get("Allow")).toContain("GET");

    const headRes = await HEAD(request);
    expect(headRes.status).toBe(200);
  });

  it("restricts forced probe execution to authenticated callers", () => {
    const unauthenticatedReq = new Request(
      "http://localhost:3000/api/v1/services/probe?force=true",
    );
    expect(isAuthorizedToForce(unauthenticatedReq)).toBe(false);

    process.env.INTERNAL_PROBE_SECRET = "secret-token-123";
    try {
      const authHeaderReq = new Request(
        "http://localhost:3000/api/v1/services/probe?force=true",
        {
          headers: { Authorization: "Bearer secret-token-123" },
        },
      );
      expect(isAuthorizedToForce(authHeaderReq)).toBe(true);

      const tokenHeaderReq = new Request(
        "http://localhost:3000/api/v1/services/probe?force=true",
        {
          headers: { "x-probe-token": "secret-token-123" },
        },
      );
      expect(isAuthorizedToForce(tokenHeaderReq)).toBe(true);

      const invalidReq = new Request(
        "http://localhost:3000/api/v1/services/probe?force=true",
        {
          headers: { "x-probe-token": "wrong" },
        },
      );
      expect(isAuthorizedToForce(invalidReq)).toBe(false);
    } finally {
      delete process.env.INTERNAL_PROBE_SECRET;
    }
  });
});
