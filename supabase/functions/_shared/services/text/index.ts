import { z } from "../../deps.ts";
import { parseRequest, selectAdapter, ServiceError } from "../types.ts";
import { createSimulatedTextAdapter } from "./simulation.ts";

export const TextRequest = z.object({
  prompt: z.string().min(1).max(200_000),
  instructions: z.string().max(20_000).optional(),
  format: z.enum(["text", "json"]).default("text"),
  /** JSON Schema the answer must follow when format is "json". */
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
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

export type StructuredTextRequest = Omit<TextRequest, "format" | "jsonSchema">;

export interface TextService {
  generate(request: TextRequest): Promise<TextResult>;
  /** Asks for a JSON answer following `schema`, then validates it. */
  generateJson<T>(request: StructuredTextRequest, schema: z.ZodType<T>): Promise<T>;
}

const adapters: Record<string, () => TextAdapter> = {
  simulation: createSimulatedTextAdapter,
};

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    return JSON.parse((fenced ? fenced[1] : text).trim());
  } catch {
    throw new ServiceError("service_failed", true, "Structured answer is not valid JSON");
  }
}

export function createTextService(providerName: string | undefined): TextService {
  async function generate(request: TextRequest): Promise<TextResult> {
    const valid = parseRequest(TextRequest, request);
    return await selectAdapter("text", adapters, providerName).generate(valid);
  }

  return {
    generate,
    async generateJson(request, schema) {
      const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
      const result = await generate({ ...request, format: "json", jsonSchema });
      const parsed = schema.safeParse(extractJson(result.text));
      if (!parsed.success) {
        throw new ServiceError("service_failed", true, `Structured answer rejected: ${parsed.error.message}`);
      }
      return parsed.data;
    },
  };
}
