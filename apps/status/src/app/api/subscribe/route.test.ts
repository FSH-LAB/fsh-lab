import { describe, expect, it } from "vitest";
import { clearSubscribersForTesting, isValidEmail, POST } from "./route";

describe("subscribe API route and email validator", () => {
  it("validates valid email formats correctly", () => {
    expect(isValidEmail("ops@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@sub.domain.co.uk")).toBe(true);
    expect(isValidEmail("admin-test@company.io")).toBe(true);
  });

  it("rejects invalid email formats and edge cases", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@domain")).toBe(false);
    expect(isValidEmail("user@.domain.com")).toBe(false);
    expect(isValidEmail("user@domain.com.")).toBe(false);
    expect(isValidEmail("user@-domain.com")).toBe(false);
    expect(isValidEmail("user@domain-.com")).toBe(false);
    expect(isValidEmail("user name@domain.com")).toBe(false);
  });

  it("safely handles long strings without polynomial ReDoS slowdown", () => {
    // Strings with many repetitions of '!.' or dots that would cause polynomial backtracking
    const attackString = "user@" + "a.".repeat(500) + "com";
    const start = performance.now();
    expect(isValidEmail(attackString)).toBe(false);
    const duration = performance.now() - start;

    // Must execute well within a few milliseconds, not seconds
    expect(duration).toBeLessThan(50);
  });

  it("rejects invalid email requests with 400", async () => {
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

  it("accepts valid email and registers subscription with 200", async () => {
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
