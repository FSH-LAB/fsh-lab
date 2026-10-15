import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const baseUrl = process.env.SMOKE_URL;
const commit = process.env.SHA;
const authToken = process.env.SMOKE_TOKEN || process.env.SMOKE_AUTH_TOKEN;
const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

assert.ok(baseUrl, "SMOKE_URL must point to a running app");
assert.match(commit ?? "", /^[0-9a-f]{40}$/, "SHA must be a full commit SHA");

async function request(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      assert.equal(response.status, 200, `${path} must return HTTP 200`);
      return await response.text();
    } catch (error) {
      if (attempt === 10) throw error;
      await setTimeout(2_000);
    }
  }
}

test(
  "health reports the deployed commit and readiness",
  { timeout: 90_000 },
  async () => {
    const data = JSON.parse(await request("/api/health"));
    assert.equal(data.status, "ok");
    assert.equal(data.commit ?? data.sha, commit);
    assert.equal(data.ready, true);
  },
);

test("status home page renders", { timeout: 90_000 }, async () => {
  const content = await request("/");
  assert.match(content, /FSH Lab System Status/i);
});

test(
  "status JSON summary API returns valid structure",
  { timeout: 90_000 },
  async () => {
    const data = JSON.parse(await request("/api/v1/status"));
    assert.ok(data.status, "response must contain status object");
    assert.match(
      data.status.indicator,
      /^(none|minor|major|critical|maintenance)$/,
    );
    assert.ok(Array.isArray(data.services) && data.services.length >= 1);
  },
);
