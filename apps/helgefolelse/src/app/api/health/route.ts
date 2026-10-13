export function GET() {
  return Response.json({
    status: "ok",
    ready: true,
    commit: process.env.GIT_SHA ?? null,
    uptime: Math.floor(process.uptime()),
  });
}
