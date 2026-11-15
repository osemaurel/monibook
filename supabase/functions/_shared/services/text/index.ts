import { z } from "../../deps.ts";
import { parseRequest, selectAdapter } from "../types.ts";
import { createSimulatedTextAdapter } from "./simulation.ts";

export const TextRequest = z.object({
  prompt: z.string().min(1).max(100_000),
  instructions: z.string().max(20_000).optional(),
  format: z.enum(["text", "json"]).default("text"),
  maxOutputTokens: z.number().int().min(1).max(32_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type TextRequest = z.input<typeof TextRequest>;
export type ValidTextRequest = z.output<typeof TextRequest>;

export interface TextResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface TextAdapter {
  generate(request: ValidTextRequest): Promise<TextResult>;
}

export interface TextService {
  generate(request: TextRequest): Promise<TextResult>;
}

const adapters: Record<string, () => TextAdapter> = {
  simulation: createSimulatedTextAdapter,
};

export function createTextService(providerName: string | undefined): TextService {
  return {
    async generate(request) {
      const valid = parseRequest(TextRequest, request);
      return await selectAdapter("text", adapters, providerName).generate(valid);
    },
  };
}
