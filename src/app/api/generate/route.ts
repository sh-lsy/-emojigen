import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { STYLE_BY_ID, type EmojiStyle } from "@/lib/styles";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateRequest {
  prompt: string;
  style: EmojiStyle;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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

  const { prompt, style, apiKey, baseUrl, model } = body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!isStyle(style)) {
    return Response.json({ error: "Unknown style" }, { status: 400 });
  }

  const serverKey =
    process.env.OPENAI_API_KEY || process.env.EMOJIGEN_API_KEY || "";
  const serverBase =
    process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1";
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

  const client = createOpenAI({
    apiKey: effectiveKey,
    baseURL: effectiveBase,
  });

  try {
    const result = streamText({
      // Force Chat Completions API so third-party OpenAI-compatible
      // endpoints (DeepSeek, SenseNova, Ollama, etc.) all work.
      // `client(model)` would default to OpenAI's new Responses API.
      model: client.chat(effectiveModel),
      system: buildSystemPrompt(style),
      prompt: buildUserPrompt(prompt.trim(), style),
      temperature: 0.9,
    });
    return result.toTextStreamResponse();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
