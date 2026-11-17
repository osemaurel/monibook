import { z } from "../../deps.ts";
import { type BinaryFile, parseRequest, selectAdapter } from "../types.ts";
import { createSimulatedImageAdapter } from "./simulation.ts";

export const TEXT_ROLES = ["headline", "subheadline", "body", "bullet", "price", "cta", "badge"] as const;

export const ImageRequest = z.object({
  prompt: z.string().min(1).max(6_000),
  width: z.number().int().min(256).max(2048).default(1024),
  height: z.number().int().min(256).max(2048).default(1024),
  count: z.number().int().min(1).max(4).default(1),
  referenceImageUrls: z.array(z.url()).max(4).default([]),
  /** Images the result must follow: "style" guides colours and mood, "product" is the item to show. */
  referenceImages: z
    .array(z.object({
      role: z.enum(["style", "product"]),
      data: z.custom<Uint8Array>((value) => value instanceof Uint8Array, "bytes expected"),
      mimeType: z.string().regex(/^image\//),
    }))
    .max(4)
    .default([]),
  /** Exact texts the image must display, most important first. The prompt describes them too. */
  textToRender: z
    .array(z.object({ role: z.enum(TEXT_ROLES), text: z.string().min(1).max(300) }))
    .max(12)
    .default([]),
});
export type ImageRequest = z.input<typeof ImageRequest>;
export type ValidImageRequest = z.output<typeof ImageRequest>;

export interface ImageResult {
  images: BinaryFile[];
}

export interface ImageAdapter {
  generate(request: ValidImageRequest): Promise<ImageResult>;
}

export interface ImageService {
  generate(request: ImageRequest): Promise<ImageResult>;
}

const adapters: Record<string, () => ImageAdapter> = {
  simulation: createSimulatedImageAdapter,
};

export function createImageService(providerName: string | undefined): ImageService {
  return {
    async generate(request) {
      const valid = parseRequest(ImageRequest, request);
      return await selectAdapter("image", adapters, providerName).generate(valid);
    },
  };
}
