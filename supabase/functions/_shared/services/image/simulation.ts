import type { ImageAdapter, ValidImageRequest } from "./index.ts";

const PALETTES = [
  ["#f97316", "#7c2d12", "#fde68a"],
  ["#0ea5e9", "#1e3a8a", "#fef08a"],
  ["#10b981", "#064e3b", "#fde047"],
  ["#a855f7", "#3b0764", "#f9a8d4"],
  ["#f43f5e", "#4c0519", "#fed7aa"],
  ["#eab308", "#713f12", "#ffffff"],
];

function hash(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function hashBytes(bytes: Uint8Array): number {
  let h = 0;
  for (let i = 0; i < bytes.length; i += Math.max(1, Math.floor(bytes.length / 4096))) {
    h = (h * 31 + bytes[i]) >>> 0;
  }
  return h;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

function background(width: number, height: number, seed: number): string {
  const [from, to] = PALETTES[seed % PALETTES.length];
  const circles = Array.from({ length: 5 }, (_, i) => {
    const r = ((seed >> (i * 3)) % 7 + 3) * width / 40;
    const cx = ((seed >> (i * 2)) % 10) * width / 10;
    const cy = height * (0.45 + ((seed >> i) % 5) / 10);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="${0.06 + i * 0.03}"/>`;
  }).join("");
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/>` +
    `<stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>${circles}`;
}

/** Abstract artwork without any text, so the real title can be laid over it. */
function placeholderArt(width: number, height: number, seed: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `${background(width, height, seed)}</svg>`;
}

/** Splits a text into lines of at most `maxChars` characters, on word boundaries. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Stand-in for a finished ad: the requested texts laid out on the artwork, and the product image when
 * one is given. A real provider draws the whole visual from the prompt and the same inputs.
 */
function adMock(request: ValidImageRequest, seed: number): string {
  const { width: w, height: h } = request;
  const accent = PALETTES[seed % PALETTES.length][2];
  const margin = Math.round(w * 0.08);
  const inner = w - 2 * margin;
  const parts: string[] = [background(w, h, seed)];
  let y = margin;

  const textBlock = (text: string, size: number, weight: number, color = "#ffffff") => {
    const lines = wrap(text, Math.floor(inner / (size * 0.56)));
    for (const line of lines) {
      y += size * 1.15;
      parts.push(
        `<text x="${margin}" y="${
          y.toFixed(0)
        }" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size.toFixed(0)}" ` +
          `font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`,
      );
    }
    y += size * 0.45;
  };

  const pill = (text: string, size: number, fill: string, color: string) => {
    const boxW = Math.min(inner, text.length * size * 0.6 + size * 1.6);
    const boxH = size * 1.9;
    parts.push(
      `<rect x="${margin}" y="${y.toFixed(0)}" width="${boxW.toFixed(0)}" height="${boxH.toFixed(0)}" rx="${
        (boxH / 2).toFixed(0)
      }" fill="${fill}"/>` +
        `<text x="${(margin + size * 0.8).toFixed(0)}" y="${
          (y + boxH * 0.66).toFixed(0)
        }" font-family="Inter, Arial, Helvetica, sans-serif" ` +
        `font-size="${size.toFixed(0)}" font-weight="700" fill="${color}">${escapeXml(text)}</text>`,
    );
    y += boxH + size * 0.6;
  };

  const texts = request.textToRender;
  const cta = texts.find((t) => t.role === "cta");
  for (const item of texts) {
    if (item.role === "headline") textBlock(item.text, w * 0.074, 800);
    else if (item.role === "subheadline") textBlock(item.text, w * 0.042, 500);
    else if (item.role === "body") textBlock(item.text, w * 0.036, 400);
    else if (item.role === "bullet") textBlock(`✓ ${item.text}`, w * 0.04, 600);
    else if (item.role === "price") pill(item.text, w * 0.055, accent, "#111111");
    else if (item.role === "badge") pill(item.text, w * 0.03, "#ffffff", "#111111");
  }

  const ctaHeight = w * 0.12;
  const ctaTop = h - margin - ctaHeight;
  const product = request.referenceImages.find((r) => r.role === "product");
  const space = ctaTop - y - w * 0.05;
  if (product && space > w * 0.2) {
    const bookH = Math.min(space, w * 0.75);
    const bookW = bookH * 2 / 3;
    const x = (w - bookW) / 2;
    const top = y + (space - bookH) / 2;
    parts.push(
      `<rect x="${(x + w * 0.015).toFixed(0)}" y="${(top + w * 0.02).toFixed(0)}" width="${
        bookW.toFixed(0)
      }" height="${bookH.toFixed(0)}" rx="${(w * 0.01).toFixed(0)}" fill="#000000" fill-opacity="0.35"/>` +
        `<image x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${bookW.toFixed(0)}" height="${
          bookH.toFixed(0)
        }" preserveAspectRatio="xMidYMid slice" ` +
        `href="data:${product.mimeType};base64,${toBase64(product.data)}"/>`,
    );
  }

  if (cta) {
    const size = w * 0.045;
    parts.push(
      `<rect x="${margin}" y="${ctaTop.toFixed(0)}" width="${inner}" height="${ctaHeight.toFixed(0)}" rx="${
        (ctaHeight / 2).toFixed(0)
      }" fill="#ffffff"/>` +
        `<text x="${(w / 2).toFixed(0)}" y="${
          (ctaTop + ctaHeight * 0.63).toFixed(0)
        }" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" ` +
        `font-size="${size.toFixed(0)}" font-weight="800" fill="#111111">${escapeXml(cta.text)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${
    parts.join("")
  }</svg>`;
}

/** Development adapter: returns distinct placeholders, costs nothing, calls nothing. */
export function createSimulatedImageAdapter(): ImageAdapter {
  return {
    generate(request) {
      const style = request.referenceImages.find((r) => r.role === "style");
      const base = hash(request.prompt) + (style ? hashBytes(style.data) : 0);
      const images = Array.from({ length: request.count }, (_, i) => {
        const seed = base + i * 7919;
        const svg = request.textToRender.length > 0
          ? adMock(request, seed)
          : placeholderArt(request.width, request.height, seed);
        return { data: new TextEncoder().encode(svg), mimeType: "image/svg+xml" };
      });
      return Promise.resolve({ images });
    },
  };
}
