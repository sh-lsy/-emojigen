import crypto from "crypto";
import {
  buildSessionCookie,
  createSession,
  ensureAdminUser,
  readSessionCookie,
  verifyCredentials,
} from "@/lib/auth";

export const runtime = "nodejs";

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(req: Request) {
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
  await ensureAdminUser(adminUser, adminPass);

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return Response.json(
      { ok: false, error: "请输入用户名和密码" },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return Response.json({ ok: false, error: "用户名或密码错误" }, { status: 401 });
  }

  const session = await createSession(user.id);
  return new Response(
    JSON.stringify({ ok: true, user }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": buildSessionCookie(session.token),
      },
    },
  );
}

export async function GET(req: Request) {
  const token = readSessionCookie(req);
  return Response.json({ ok: true, endpoint: "login" });
}
