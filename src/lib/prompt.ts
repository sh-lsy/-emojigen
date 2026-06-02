import type { EmojiStyle } from "./styles";
import { STYLE_BY_ID } from "./styles";

const BASE_RULES = `You generate tiny, high-quality SVG emoji/sticker illustrations.

Hard rules (NEVER break):
1. Output EXACTLY one <svg>...</svg> block. No prose, no markdown fences, no commentary before or after.
2. The SVG MUST be self-contained: include xmlns="http://www.w3.org/2000/svg".
3. Use viewBox="0 0 128 128" so the artwork is square and crisp at any size.
4. Keep total file size small (<6KB). Avoid <image>, <foreignObject>, external fonts, gradients with >3 stops, filters that aren't strictly needed.
5. Use simple shapes: <circle>, <ellipse>, <rect rx/ry>, <path d="...">, <polygon>, <line>, <g>, <text>.
6. Solid fills and a small palette (3-6 colors). Strokes are optional but should match the style.
7. The subject MUST be centered and fully visible inside the 128x128 viewBox. Leave a small margin (>=4px).
8. Do NOT include any text characters (no words, no letters) inside the SVG unless the user explicitly asks for text in the emoji.
9. Do NOT use scripts, animations, or interactivity.
10. No comments inside the SVG.`;

export function buildSystemPrompt(style: EmojiStyle): string {
  const def = STYLE_BY_ID[style];
  return `${BASE_RULES}

Current style: ${def.name}.
Style guidance: ${def.promptHint}

Make it visually delightful. Lean into the style's signature traits.`;
}

export function buildUserPrompt(userPrompt: string, style: EmojiStyle): string {
  const def = STYLE_BY_ID[style];
  return `Subject: ${userPrompt}

Style: ${def.name} — ${def.promptHint}

Output the single <svg> element now.`;
}
