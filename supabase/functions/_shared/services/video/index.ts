import { z } from "../../deps.ts";
import { type BinaryFile, parseRequest, selectAdapter, type ServiceErrorCode } from "../types.ts";
import { createSimulatedVideoAdapter } from "./simulation.ts";

export const VideoRequest = z.object({
  prompt: z.string().min(1).max(4_000),
  durationSeconds: z.number().int().min(1).max(60).default(8),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  imageUrl: z.url().optional(),
});
export type VideoRequest = z.input<typeof VideoRequest>;
export type ValidVideoRequest = z.output<typeof VideoRequest>;

/** Video generation is long-running: submit, then poll until done or failed. */
export type VideoStatus =
  | { state: "pending"; progress?: number }
  | { state: "done"; video: BinaryFile }
  | { state: "failed"; reason: ServiceErrorCode };

export interface VideoAdapter {
  submit(request: ValidVideoRequest): Promise<{ taskId: string }>;
  poll(taskId: string): Promise<VideoStatus>;
}

export interface VideoService {
  submit(request: VideoRequest): Promise<{ taskId: string }>;
  poll(taskId: string): Promise<VideoStatus>;
}

const adapters: Record<string, () => VideoAdapter> = {
  simulation: createSimulatedVideoAdapter,
};

export function createVideoService(providerName: string | undefined): VideoService {
  return {
    async submit(request) {
      const valid = parseRequest(VideoRequest, request);
      return await selectAdapter("video", adapters, providerName).submit(valid);
    },
    async poll(taskId) {
      return await selectAdapter("video", adapters, providerName).poll(taskId);
    },
  };
}
