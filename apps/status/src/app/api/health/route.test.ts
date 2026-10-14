import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health API route", () => {
  it("returns ok status and readiness", async () => {
    const response = GET();
    const data = await response.json();

    expect(data.status).toBe("ok");
    expect(data.ready).toBe(true);
    expect(typeof data.uptime).toBe("number");
  });
});
