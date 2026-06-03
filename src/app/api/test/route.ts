import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";

interface TestRequest {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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
    process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
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

  const client = createOpenAI({
    apiKey: effectiveKey,
    baseURL: effectiveBase,
  });

  const start = Date.now();
  try {
    // Tiny request: just 5 tokens. Verifies auth, base URL, model, network.
    // Use .chat() to force Chat Completions API for third-party compatibility.
    const result = await generateText({
      model: client.chat(effectiveModel),
      prompt: "ok",
      maxOutputTokens: 5,
    });
    return Response.json({
      ok: true,
      latencyMs: Date.now() - start,
      model: effectiveModel,
      baseUrl: effectiveBase,
      sample: result.text.slice(0, 40),
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
