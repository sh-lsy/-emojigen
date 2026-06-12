export const runtime = "nodejs";
import { getUserBySessionToken, readSessionCookie } from "@/lib/auth";
import { isPresetModel, getPresetByModel } from "@/lib/presets";

interface TestRequest {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

// Same whitelist as generate route
const ALLOWED_HOSTS = [
  "api.openai.com",
  "api.deepseek.com",
  "open.bigmodel.cn",
  "dashscope.aliyuncs.com",
  "token.sensenova.cn",
  "openrouter.ai",
  "api.siliconflow.cn",
  "api.minimax.chat",
  "localhost",
  "127.0.0.1",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: TestRequest;
  try {
    body = (await req.json()) as TestRequest;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const serverKey =
    process.env.OPENAI_API_KEY || process.env.EMOJIGEN_API_KEY || "";
  const serverBase =
    process.env.OPENAI_BASE_URL || "https://token.sensenova.cn/v1";
  const serverModel = process.env.EMOJIGEN_MODEL || "deepseek-v4-flash";

  const effectiveKey = body.apiKey?.trim() || serverKey;
  if (!effectiveKey) {
    return Response.json(
      {
        ok: false,
        error: "No API key. 请在 UI 设置里填一个,或在服务端配置 OPENAI_API_KEY。",
      },
      { status: 400 },
    );
  }

  const effectiveBase = body.baseUrl?.trim() || serverBase;
  const effectiveModel = body.model?.trim() || serverModel;

  if (isPresetModel(effectiveModel)) {
    const preset = getPresetByModel(effectiveModel);
    if (preset?.requireAuth) {
      const token = readSessionCookie(req);
      const user = await getUserBySessionToken(token);
      if (!user) {
        return Response.json(
          {
            ok: false,
            error: `模型 "${effectiveModel}" 需要登录后才能使用。`,
            model: effectiveModel,
            baseUrl: effectiveBase,
          },
          { status: 401 },
        );
      }
    }
  }

  if (!isAllowedUrl(effectiveBase)) {
    return Response.json(
      { ok: false, error: `URL 不在白名单中: ${effectiveBase}` },
      { status: 403 },
    );
  }

  const upstreamUrl = `${effectiveBase.replace(/\/+$/, "")}/chat/completions`;

  const start = Date.now();
  try {
    // Tiny request: just 5 tokens. Verifies auth, base URL, model, network.
    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: [{ role: "user", content: "ok" }],
        max_tokens: 5,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return Response.json({
        ok: false,
        latencyMs: Date.now() - start,
        error: humanizeError(
          `${res.status}: ${errText.slice(0, 200)}`,
          effectiveBase,
          effectiveModel,
        ),
        model: effectiveModel,
        baseUrl: effectiveBase,
      });
    }

    const json = await res.json();
    const sample = json.choices?.[0]?.message?.content ?? "";

    return Response.json({
      ok: true,
      latencyMs: Date.now() - start,
      model: effectiveModel,
      baseUrl: effectiveBase,
      sample: sample.slice(0, 40),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    return Response.json({
      ok: false,
      latencyMs: Date.now() - start,
      error: humanizeError(raw, effectiveBase, effectiveModel),
      model: effectiveModel,
      baseUrl: effectiveBase,
    });
  }
}

function humanizeError(raw: string, baseUrl: string, model: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key")) {
    return "API Key 无效或已过期,请检查。";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "权限被拒。Key 可能没有该模型的访问权限,或账户欠费。";
  }
  if (lower.includes("404") || lower.includes("model not found") || lower.includes("not found")) {
    return `模型 "${model}" 不存在。请检查 Model 名称是否正确。`;
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "请求过于频繁,稍后再试。";
  }
  if (lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("network")) {
    return `无法连接到 ${baseUrl}。检查网络或 Base URL。`;
  }
  if (lower.includes("timeout") || lower.includes("etimedout")) {
    return "连接超时。检查网络代理或 Base URL。";
  }
  return raw;
}
