export type EmojiStyle =
  | "kawaii"
  | "line-art"
  | "retro-8bit"
  | "cyberpunk"
  | "hand-drawn"
  | "minimal";

export interface StyleDef {
  id: EmojiStyle;
  name: string;
  emoji: string;
  description: string;
  promptHint: string;
}

export const STYLES: StyleDef[] = [
  {
    id: "kawaii",
    name: "Kawaii 可爱",
    emoji: "🥺",
    description: "胖嘟嘟、圆眼睛、腮红的萌系贴纸",
    promptHint:
      "kawaii sticker style, chubby round shapes, big sparkly eyes, soft pink cheeks, glossy highlights, soft pastel colors, white outline, centered subject",
  },
  {
    id: "line-art",
    name: "Line Art 线描",
    emoji: "✏️",
    description: "简洁优雅的极细线条画",
    promptHint:
      "minimalist single-line drawing, continuous line art, black strokes on transparent background, elegant simple shapes, no fill, zen aesthetic",
  },
  {
    id: "retro-8bit",
    name: "8-Bit 像素",
    emoji: "👾",
    description: "复古街机游戏像素艺术",
    promptHint:
      "retro 8-bit pixel art, NES-style sprite, limited color palette, blocky pixelated edges, video game icon aesthetic, sharp pixels",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk 赛博",
    emoji: "🌃",
    description: "霓虹光效、未来感赛博朋克",
    promptHint:
      "cyberpunk neon style, glowing magenta and cyan accents, futuristic circuit details, dark background implied, sharp angular shapes, electric energy",
  },
  {
    id: "hand-drawn",
    name: "Hand-drawn 手绘",
    emoji: "🎨",
    description: "水彩 / 马克笔质感手绘",
    promptHint:
      "hand-drawn doodle style, watercolor and marker textures, slightly imperfect lines, warm friendly feel, sketch-like crosshatching",
  },
  {
    id: "minimal",
    name: "Minimal 极简",
    emoji: "⚪",
    description: "几何、扁平、克制",
    promptHint:
      "minimal flat icon, geometric shapes, two or three colors only, clean composition, modern brand-icon aesthetic, plenty of negative space",
  },
];

export const STYLE_BY_ID: Record<EmojiStyle, StyleDef> = STYLES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<EmojiStyle, StyleDef>,
);

export interface Generation {
  id: string;
  prompt: string;
  style: EmojiStyle;
  svg: string;
  createdAt: number;
}
