import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { STYLE_BY_ID, type EmojiStyle } from "@/lib/styles";
import { getUserBySessionToken, readSessionCookie } from "@/lib/auth";
import { isPresetModel, getPresetByModel } from "@/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 120;

// Maximum prompt length to prevent abuse
const MAX_PROMPT_LENGTH = 500;

// Whitelist of allowed upstream API hosts to prevent SSRF attacks
const ALLOWED_HOSTS = [
  // OpenAI
  "api.openai.com",
  // DeepSeek
  "api.deepseek.com",
  // Zhipu (GLM)
  "open.bigmodel.cn",
  // Alibaba (Qwen)
  "dashscope.aliyuncs.com",
  // SenseNova
  "token.sensenova.cn",
  // OpenRouter
  "openrouter.ai",
  // SiliconFlow
  "api.siliconflow.cn",
  // Minimax
  "api.minimax.chat",
  // Local development
  "localhost",
  "127.0.0.1",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Only allow http/https protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    // Check host against whitelist
    return ALLOWED_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

interface GenerateRequest {
  prompt: string;
  style: EmojiStyle;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "none";
}

function isStyle(s: unknown): s is EmojiStyle {
  return typeof s === "string" && s in STYLE_BY_ID;
}

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, style, apiKey, baseUrl, model, reasoningEffort } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` },
      { status: 400 },
    );
  }
  if (!isStyle(style)) {
    return Response.json({ error: "Unknown style" }, { status: 400 });
  }

  const serverKey =
    process.env.OPENAI_API_KEY || process.env.EMOJIGEN_API_KEY || "";
  const serverBase =
    process.env.OPENAI_BASE_URL || "https://token.sensenova.cn/v1";
  const serverModel = process.env.EMOJIGEN_MODEL || "deepseek-v4-flash";

  const effectiveKey = apiKey?.trim() || serverKey;
  if (!effectiveKey) {
    return Response.json(
      {
        error:
          "No API key. Set OPENAI_API_KEY on the server, or paste your key in the UI settings.",
      },
      { status: 401 },
    );
  }

  const effectiveBase = baseUrl?.trim() || serverBase;
  const effectiveModel = model?.trim() || serverModel;
  const effectiveReasoningEffort = reasoningEffort || undefined;

  // Auth gate: only applies to preset models that are marked requireAuth.
  // User-customized model names (not in PRESETS) are not checked.
  if (isPresetModel(effectiveModel)) {
    const preset = getPresetByModel(effectiveModel);
    if (preset?.requireAuth) {
      const token = readSessionCookie(req);
      const user = await getUserBySessionToken(token);
      if (!user) {
        return Response.json(
          {
            error: `模型 "${effectiveModel}" 需要登录后才能使用。请先登录账号。`,
          },
          { status: 401 },
        );
      }
    }
  }

  // SSRF protection: validate upstream URL
  if (!isAllowedUrl(effectiveBase)) {
    return Response.json(
      { error: `Upstream URL not allowed. Allowed hosts: ${ALLOWED_HOSTS.join(", ")}` },
      { status: 403 },
    );
  }

  // --- Direct upstream fetch + SSE parsing ---
  // Bypasses Vercel AI SDK to properly capture reasoning_content from
  // DeepSeek V4 and other providers that use this field.
  const upstreamUrl = `${effectiveBase.replace(/\/+$/, "")}/chat/completions`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: [
          { role: "system", content: buildSystemPrompt(style) },
          { role: "user", content: buildUserPrompt(prompt.trim(), style) },
        ],
        temperature: 0.9,
        ...(effectiveReasoningEffort
          ? { reasoning_effort: effectiveReasoningEffort }
          : {}),
        stream: true,
      }),
      signal: req.signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    const msg = err instanceof Error ? err.message : "Upstream fetch error";
    return Response.json({ error: msg }, { status: 502 });
  }

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => "");
    return Response.json(
      { error: `上游 API 返回 ${upstreamRes.status}: ${errText.slice(0, 300)}` },
      { status: 502 },
    );
  }

  if (!upstreamRes.body) {
    return Response.json({ error: "Upstream returned no body" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const reqStart = Date.now();
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();

  const customStream = new ReadableStream({
    async start(controller) {
      // Send heartbeat immediately (padded to >4KB to break proxy buffers)
      const pad = " ".repeat(4096);
      controller.enqueue(
        encoder.encode(
          JSON.stringify({ t: "h", c: "", _pad: pad }) + "\n",
        ),
      );

      // Keepalive heartbeat every 15s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: "h", c: "" }) + "\n"),
          );
        } catch { /* stream already closed */ }
      }, 15_000);

      let buffer = "";
      let firstToken = true;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta;
              if (!delta) continue;

              // Capture reasoning_content (DeepSeek V4, etc.)
              const reasoning = delta.reasoning_content || delta.reasoning;
              if (reasoning) {
                if (firstToken) {
                  firstToken = false;
                  console.log(`[api/generate] first reasoning token after ${Date.now() - reqStart}ms`);
                }
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "r", c: reasoning }) + "\n"),
                );
              }

              // Capture text content
              const content = delta.content;
              if (content) {
                if (firstToken) {
                  firstToken = false;
                  console.log(`[api/generate] first text token after ${Date.now() - reqStart}ms`);
                }
                controller.enqueue(
                  encoder.encode(JSON.stringify({ t: "t", c: content }) + "\n"),
                );
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }

        const total = Date.now() - reqStart;
        console.log(`[api/generate] stream complete in ${total}ms`);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              t: "e",
              c: err instanceof Error ? err.message : "Stream read error",
            }) + "\n",
          ),
        );
      } finally {
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      try { reader.cancel(); } catch { /* noop */ }
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
