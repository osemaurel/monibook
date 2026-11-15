import { z } from "../../deps.ts";
import { type BinaryFile, parseRequest, selectAdapter } from "../types.ts";
import { createSimulatedImageAdapter } from "./simulation.ts";

export const ImageRequest = z.object({
  prompt: z.string().min(1).max(4_000),
  width: z.number().int().min(256).max(2048).default(1024),
  height: z.number().int().min(256).max(2048).default(1024),
  count: z.number().int().min(1).max(4).default(1),
  referenceImageUrls: z.array(z.url()).max(4).default([]),
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
