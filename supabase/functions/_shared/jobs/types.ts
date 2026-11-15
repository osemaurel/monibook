import { z } from "../deps.ts";
import type { Services } from "../services/index.ts";

export const ClaimedJob = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  project_id: z.uuid(),
  kind: z.string(),
  input: z.unknown(),
  attempts: z.number().int().min(1),
});
export type ClaimedJob = z.infer<typeof ClaimedJob>;

export interface AssetDraft {
  kind: "document" | "image" | "video" | "audio" | "text";
  title?: string;
  storage_path?: string;
  mime_type?: string;
  size_bytes?: number;
  content?: unknown;
}

export interface JobResult {
  output: Record<string, unknown>;
  assets?: AssetDraft[];
}

export interface JobContext {
  jobId: string;
  userId: string;
  projectId: string;
  attempt: number;
  services: Services;
  /** Records progress (0-99) and the current step, in French, shown to the user. */
  progress(percent: number, step: string): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export interface JobKindDefinition<Input> {
  input: z.ZodType<Input>;
  run(input: Input, ctx: JobContext): Promise<JobResult>;
}

export function defineJobKind<Input>(definition: JobKindDefinition<Input>): JobKindDefinition<Input> {
  return definition;
}
