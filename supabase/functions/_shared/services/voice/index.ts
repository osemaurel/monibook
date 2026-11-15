import { z } from "../../deps.ts";
import { type BinaryFile, parseRequest, selectAdapter } from "../types.ts";
import { createSimulatedVoiceAdapter } from "./simulation.ts";

export const VoiceRequest = z.object({
  text: z.string().min(1).max(5_000),
  // Monibook voice identifier; each adapter maps it to its own catalogue.
  voice: z.string().regex(/^[a-z]{2}-[a-z0-9-]+$/).default("fr-standard"),
  speed: z.number().min(0.5).max(2).default(1),
});
export type VoiceRequest = z.input<typeof VoiceRequest>;
export type ValidVoiceRequest = z.output<typeof VoiceRequest>;

export interface VoiceResult {
  audio: BinaryFile;
}

export interface VoiceAdapter {
  synthesize(request: ValidVoiceRequest): Promise<VoiceResult>;
}

export interface VoiceService {
  synthesize(request: VoiceRequest): Promise<VoiceResult>;
}

const adapters: Record<string, () => VoiceAdapter> = {
  simulation: createSimulatedVoiceAdapter,
};

export function createVoiceService(providerName: string | undefined): VoiceService {
  return {
    async synthesize(request) {
      const valid = parseRequest(VoiceRequest, request);
      return await selectAdapter("voice", adapters, providerName).synthesize(valid);
    },
  };
}
