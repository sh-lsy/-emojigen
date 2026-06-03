import type { EmojiStyle } from "./styles";
import { STYLE_BY_ID } from "./styles";

const BASE_RULES = `Output exactly ONE valid <svg> element. First character must be '<', last character must be '>'. No prose, no markdown fences, no commentary, no greetings.

Requirements:
- xmlns="http://www.w3.org/2000/svg", viewBox="0 0 128 128"
- Keep under 6KB. Use simple primitives: circle, ellipse, rect, path, polygon, line, g
- 3–6 solid colors. No filters, no images, no foreignObject, no scripts, no animations, no comments
- Subject centered with at least 4px margin
- Do NOT include text characters unless the user explicitly asks for words
- If you cannot follow these rules, output exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="48" fill="#ff6b6b"/></svg>`;

export function buildSystemPrompt(style: EmojiStyle): string {
  const def = STYLE_BY_ID[style];
  return `${BASE_RULES}\n\nStyle: ${def.name}\nStyle guidance: ${def.promptHint}`;
}

export function buildUserPrompt(userPrompt: string, style: EmojiStyle): string {
  const def = STYLE_BY_ID[style];
  return `Subject: ${userPrompt}\nStyle: ${def.name} — ${def.promptHint}\n\nRespond with ONLY the <svg> element. First char '<', last char '>'.`;
}