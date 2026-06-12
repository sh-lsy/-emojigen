// Shared model presets used by both the client UI and the server.
// Adding/removing entries here is the only source of truth.
export interface ModelPreset {
  label: string;
  baseUrl: string;
  model: string;
  /** If true, an authenticated session is required to use this model. */
  requireAuth?: boolean;
  /** If true, the server provides a default API Key — user doesn't need to fill one. */
  useServerKey?: boolean;
  /** If true, the server currently has a working API Key for this model's baseUrl. */
  isDefault?: boolean;
  /** If true, the model supports reasoning/thinking mode with adjustable effort. */
  supportsThinking?: boolean;
}

export const PRESETS: ModelPreset[] = [
  { label: "商汤 SenseNova 6.7 (免费)", baseUrl: "https://token.sensenova.cn/v1", model: "sensenova-6.7-flash-lite", useServerKey: true, supportsThinking: true, isDefault: true },
  { label: "商汤 DeepSeek V4 ⭐", baseUrl: "https://token.sensenova.cn/v1", model: "deepseek-v4-flash", requireAuth: true, useServerKey: true, supportsThinking: true, isDefault: true },
  { label: "智谱 GLM-4-Flash", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", supportsThinking: true },
  { label: "DeepSeek V4-Flash", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash", supportsThinking: true },
  { label: "DeepSeek V4-Pro", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-pro", supportsThinking: true },
  { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { label: "Ollama(本地)", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" },
];

/** Models that require auth to use. Derived from PRESETS — single source of truth. */
export const RESTRICTED_MODELS: Set<string> = new Set(
  PRESETS.filter((p) => p.requireAuth).map((p) => p.model),
);

/** Look up whether a model is in the preset list (regardless of auth requirement). */
export function isPresetModel(model: string): boolean {
  const trimmed = model.trim();
  return PRESETS.some((p) => p.model === trimmed);
}

/** Look up a preset by its model name. */
export function getPresetByModel(model: string): ModelPreset | undefined {
  const trimmed = model.trim();
  return PRESETS.find((p) => p.model === trimmed);
}
