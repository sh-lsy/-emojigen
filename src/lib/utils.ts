import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractSvg(text: string): string | null {
  // Strip markdown code fences the model might wrap the SVG in.
  const cleaned = text
    .replace(/^```(?:svg|xml|html)?\s*\n/i, "")
    .replace(/\n```\s*$/i, "")
    .replace(/```/g, "");

  // First, try to find a complete <svg>...</svg> block.
  const match = cleaned.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (match) return sanitizeSvg(match[0]);

  // Fallback: the model may have been cut off mid-output. Try to salvage
  // everything from the first <svg> opening tag onward so the user at
  // least gets a partial preview.
  const opening = cleaned.match(/<svg\b[\s\S]*/i);
  if (opening) {
    let partial = opening[0].trim();
    if (!partial.endsWith(">")) partial += ">";
    if (!/xmlns=/.test(partial)) {
      partial = partial.replace(
        /<svg/i,
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }
    if (!/viewBox=/.test(partial)) {
      partial = partial.replace(/<svg/i, '<svg viewBox="0 0 128 128"');
    }
    return sanitizeSvg(partial);
  }

  return null;
}

/**
 * Sanitize SVG content to prevent XSS attacks.
 * Removes dangerous elements like <script>, event handlers, and external references.
 */
export function sanitizeSvg(svg: string): string {
  // Remove <script> tags and their content
  let clean = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");

  // Remove event handlers (onload, onerror, onclick, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  clean = clean.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove javascript: URLs
  clean = clean.replace(/javascript\s*:/gi, "");

  // Remove data: URLs (except for safe image formats)
  clean = clean.replace(
    /href\s*=\s*["']data:(?!image\/(png|jpeg|gif|webp))/gi,
    'href="',
  );

  // Remove external URL references in xlink:href and href
  clean = clean.replace(
    /(xlink:href|href)\s*=\s*["']https?:\/\/[^"']*["']/gi,
    '$1=""',
  );

  // Remove <foreignObject> which can contain HTML
  clean = clean.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");

  // Remove <use> with external references
  clean = clean.replace(/<use\b[^>]*xlink:href\s*=\s*["']https?:[^"']*["'][^>]*\/?>/gi, "");

  return clean;
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function svgToPngBlob(
  svg: string,
  size = 512,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context unavailable"));
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (b) resolve(b);
        else reject(new Error("toBlob failed"));
      }, "image/png");
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function downloadPng(svg: string, filename: string, size = 512) {
  const blob = await svgToPngBlob(svg, size);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
