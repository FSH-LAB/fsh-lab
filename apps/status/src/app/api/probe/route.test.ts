import { describe, expect, it } from "vitest";
import { getProbeSnapshot, resetProbeCacheForTesting } from "@/lib/probe";
import { GET } from "./route";

describe("probe route and engine", () => {
  it("classifies fast 2xx responses as operational", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: "helgefolelse",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results.helgefolelse).toBeDefined();
    expect(results.helgefolelse?.status).toBe("operational");
    expect(results.helgefolelse?.statusCode).toBe(200);
    expect(results.helgefolelse?.probeType).toBe("http_probe");
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
      targetId: "helgefolelse",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results.helgefolelse?.status).toBe("major_outage");
    expect(results.helgefolelse?.statusCode).toBe(502);
  });

  it("classifies 4xx errors as degraded performance", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () =>
      new Response("Not Found", {
        status: 404,
      });

    const results = await getProbeSnapshot({
      force: true,
      targetId: "helgefolelse",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results.helgefolelse?.status).toBe("degraded_performance");
    expect(results.helgefolelse?.statusCode).toBe(404);
  });

  it("classifies network connection failure as major outage", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () => {
      throw new Error("connect ECONNREFUSED");
    };

    const results = await getProbeSnapshot({
      force: true,
      targetId: "helgefolelse",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results.helgefolelse?.status).toBe("major_outage");
    expect(results.helgefolelse?.error).toBe("connect ECONNREFUSED");
  });

  it("classifies timeout errors as degraded performance", async () => {
    resetProbeCacheForTesting();
    const mockFetch = async () => {
      const err = new Error("The operation timed out");
      err.name = "TimeoutError";
      throw err;
    };

    const results = await getProbeSnapshot({
      force: true,
      targetId: "helgefolelse",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results.helgefolelse?.status).toBe("degraded_performance");
  });

  it("marks unmonitored platform components as platform_managed with 0ms latency", async () => {
    resetProbeCacheForTesting();
    const results = await getProbeSnapshot({
      force: true,
      targetId: "cloud-run",
    });

    expect(results["cloud-run"]).toBeDefined();
    expect(results["cloud-run"]?.probeType).toBe("platform_managed");
    expect(results["cloud-run"]?.latencyMs).toBe(0);
    expect(results["cloud-run"]?.status).toBe("operational");
  });

  it("handles GET request on route with target parameter", async () => {
    resetProbeCacheForTesting();
    const request = new Request("http://localhost:3000/api/probe?id=cloud-run");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results["cloud-run"]).toBeDefined();
    expect(Object.keys(data.results)).toHaveLength(1);
  });
});
