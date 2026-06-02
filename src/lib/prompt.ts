import type { EmojiStyle } from "./styles";
import { STYLE_BY_ID } from "./styles";

const BASE_RULES = `You are a precise SVG illustration generator. Your only job is to output ONE valid SVG.

OUTPUT FORMAT — critical:
- Your ENTIRE response must be a single <svg>...</svg> element.
- No prose, no greetings, no explanation, no markdown fences (no \`\`\`), no commentary.
- The very first character of your response must be '<'.
- The very last character of your response must be '>'.

SVG STRUCTURE — critical:
- Include xmlns="http://www.w3.org/2000/svg" on the <svg> tag.
- Use viewBox="0 0 128 128" so it renders square at any size.
- Keep total size under 6KB.
- Use simple primitives: <circle>, <ellipse>, <rect rx/ry>, <path d="...">, <polygon>, <line>, <g>, <text>.
- 3–6 solid colors. No filters, no <image>, no <foreignObject>, no external fonts, no scripts, no animations, no comments.
- Subject centered inside the 128x128 box with at least 4px margin.
- Do not include any text characters inside the SVG unless the user explicitly asks for words in the emoji.

If you cannot follow these rules for any reason, output exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="48" fill="#ff6b6b"/></svg>`;

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

Remember: respond with ONLY the <svg> element. First character '<', last character '>'. Nothing else.`;
}
