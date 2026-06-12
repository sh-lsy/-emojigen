import { createUser } from "@/lib/auth";

export const runtime = "nodejs";

interface RegisterBody {
  username?: string;
  password?: string;
}

export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
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

  try {
    const user = await createUser(username, password);
    return Response.json({ ok: true, user });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "注册失败" },
      { status: 400 },
    );
  }
}
