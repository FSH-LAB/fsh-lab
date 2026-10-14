import { ACTIVE_INCIDENTS, PAST_INCIDENTS } from "@/lib/incidents";

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

export function GET() {
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

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>FSH Lab Status Updates</title>
  <subtitle>System status and incident updates for all FSH Lab applications</subtitle>
  <link href="https://status.fsh-lab.dev" />
  <link href="https://status.fsh-lab.dev/api/feed.xml" rel="self" />
  <updated>${now}</updated>
  <id>urn:uuid:fsh-lab-status-feed</id>
  ${entriesXml}
</feed>`;

  return new Response(atomXml.trim(), {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
