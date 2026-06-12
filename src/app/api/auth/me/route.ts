import { getUserBySessionToken, readSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = readSessionCookie(req);
  const user = await getUserBySessionToken(token);
  return Response.json({ ok: true, user, loggedIn: !!user });
}
