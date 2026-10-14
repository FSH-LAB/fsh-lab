import { describe, expect, it } from "vitest";
import { clearSubscribersForTesting, POST } from "./route";

describe("subscribe API route", () => {
  it("rejects invalid email formats", async () => {
    clearSubscribersForTesting();
    const request = new Request("http://localhost:3000/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("accepts valid email and registers subscription", async () => {
    clearSubscribersForTesting();
    const request = new Request("http://localhost:3000/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.email).toBe("ops@example.com");
  });
});
