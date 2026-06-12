import { buildLogoutCookie, destroySession, readSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = readSessionCookie(req);
  if (token) await destroySession(token);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildLogoutCookie(),
    },
  });
}
