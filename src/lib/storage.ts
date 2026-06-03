import type { Generation, EmojiStyle } from "./styles";
import { STYLE_BY_ID } from "./styles";
import { genId } from "./utils";

const STORAGE_KEY = "emojigen:history:v1";
const MAX_HISTORY = 24;

export interface Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const SETTINGS_KEY = "emojigen:settings:v1";

const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  model: "glm-4-flash",
};

export function loadHistory(): Generation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Generation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: Generation[]) {
  if (typeof window === "undefined") return;
  const trimmed = items.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function appendHistory(
  current: Generation[],
  prompt: string,
  style: EmojiStyle,
  svg: string,
): Generation[] {
  const item: Generation = {
    id: genId(),
    prompt,
    style,
    svg,
    createdAt: Date.now(),
  };
  const next = [item, ...current].slice(0, MAX_HISTORY);
  saveHistory(next);
  return next;
}

export function removeFromHistory(
  current: Generation[],
  id: string,
): Generation[] {
  const next = current.filter((g) => g.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): Generation[] {
  if (typeof window === "undefined") return [];
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export interface ModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const CONFIGS_KEY = "emojigen:configs:v1";
const MAX_CONFIGS = 20;

export function loadConfigs(): ModelConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONFIGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ModelConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConfigs(items: ModelConfig[]) {
  if (typeof window === "undefined") return;
  const trimmed = items.slice(0, MAX_CONFIGS);
  localStorage.setItem(CONFIGS_KEY, JSON.stringify(trimmed));
}

export function addConfig(
  current: ModelConfig[],
  input: Omit<ModelConfig, "id">,
): ModelConfig[] {
  const item: ModelConfig = { id: genId(), ...input };
  const next = [item, ...current].slice(0, MAX_CONFIGS);
  saveConfigs(next);
  return next;
}

export function removeConfig(current: ModelConfig[], id: string): ModelConfig[] {
  const next = current.filter((c) => c.id !== id);
  saveConfigs(next);
  return next;
}

export function renameConfig(
  current: ModelConfig[],
  id: string,
  name: string,
): ModelConfig[] {
  const next = current.map((c) => (c.id === id ? { ...c, name } : c));
  saveConfigs(next);
  return next;
}

export function styleName(s: EmojiStyle): string {
  return STYLE_BY_ID[s]?.name ?? s;
}
