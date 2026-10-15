import { ACTIVE_INCIDENTS, PAST_INCIDENTS } from "@/lib/incidents";
import { optionsResponse } from "@/lib/rest";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export function GET(request: Request) {
  const incidents = [...ACTIVE_INCIDENTS, ...PAST_INCIDENTS];
  const now = new Date().toISOString();

  const entriesXml = incidents
    .map((inc) => {
      const latestUpdate = inc.updates[0]?.message ?? "";
      return `
    <entry>
      <id>urn:uuid:${inc.id}</id>
      <title>${escapeXml(inc.title)}</title>
      <updated>${inc.updatedAt}</updated>
      <published>${inc.createdAt}</published>
      <summary type="text">${escapeXml(latestUpdate)}</summary>
      <content type="html"><![CDATA[
        <p><strong>Status:</strong> ${inc.status}</p>
        <p><strong>Impact:</strong> ${inc.impact}</p>
        <p><strong>Affected Services:</strong> ${inc.affectedServiceIds.join(", ")}</p>
        <p>${latestUpdate}</p>
      ]]></content>
    </entry>`;
    })
    .join("");

  const requestOrigin = request ? new URL(request.url).origin : "";
  const statusUrl =
    process.env.NEXT_PUBLIC_STATUS_URL ||
    process.env.STATUS_URL ||
    requestOrigin ||
    "/";

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>FSH Lab Status Updates</title>
  <subtitle>System status and incident updates for all FSH Lab applications</subtitle>
  <link href="${statusUrl}" />
  <link href="${statusUrl.replace(/\/$/, "")}/api/v1/feed" rel="self" />
  <updated>${now}</updated>
  <id>urn:uuid:fsh-lab-status-feed</id>
  ${entriesXml}
</feed>`;

  return new Response(atomXml.trim(), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function HEAD() {
  return new Response(null, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
