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
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-v4-flash",
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

export interface CustomPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
}

const CUSTOM_PRESETS_KEY = "emojigen:custom-presets:v1";

export function loadCustomPresets(): CustomPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

export function styleName(s: EmojiStyle): string {
  return STYLE_BY_ID[s]?.name ?? s;
}
