import type { ImageAdapter } from "./index.ts";

// 1x1 grey PNG.
const PLACEHOLDER_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

/** Development adapter: returns placeholder images, costs nothing, calls nothing. */
export function createSimulatedImageAdapter(): ImageAdapter {
  return {
    generate(request) {
      const images = Array.from({ length: request.count }, () => ({
        data: PLACEHOLDER_PNG,
        mimeType: "image/png",
      }));
      return Promise.resolve({ images });
    },
  };
}
