import type { ImageAdapter } from "./index.ts";

const PALETTES = [
  ["#f97316", "#7c2d12"],
  ["#0ea5e9", "#1e3a8a"],
  ["#10b981", "#064e3b"],
  ["#a855f7", "#3b0764"],
  ["#f43f5e", "#4c0519"],
  ["#eab308", "#713f12"],
];

function hash(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Abstract artwork without any text, so the real title can be laid over it. */
function placeholderArt(width: number, height: number, seed: number): string {
  const [from, to] = PALETTES[seed % PALETTES.length];
  const circles = Array.from({ length: 5 }, (_, i) => {
    const r = ((seed >> (i * 3)) % 7 + 3) * width / 40;
    const cx = ((seed >> (i * 2)) % 10) * width / 10;
    const cy = height * (0.45 + ((seed >> i) % 5) / 10);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="${0.06 + i * 0.03}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/>` +
    `<stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>${circles}</svg>`;
}

/** Development adapter: returns distinct abstract placeholders, costs nothing, calls nothing. */
export function createSimulatedImageAdapter(): ImageAdapter {
  return {
    generate(request) {
      const base = hash(request.prompt);
      const images = Array.from({ length: request.count }, (_, i) => ({
        data: new TextEncoder().encode(placeholderArt(request.width, request.height, base + i * 7919)),
        mimeType: "image/svg+xml",
      }));
      return Promise.resolve({ images });
    },
  };
}
