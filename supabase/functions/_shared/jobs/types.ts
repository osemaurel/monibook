import { z } from "../deps.ts";
import type { EbookStore, FileStore } from "../ebook/types.ts";
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

export type JobResult =
  | { output: Record<string, unknown>; assets?: AssetDraft[] }
  /** Work saved so far is kept; a later worker invocation continues the same attempt. */
  | { continueLater: true };

/** Domain data the executors read and write, besides the job itself. */
export interface DataAccess {
  ebooks: EbookStore;
  files: FileStore;
}

export interface JobContext {
  jobId: string;
  kind: string;
  userId: string;
  projectId: string;
  attempt: number;
  services: Services;
  data: DataAccess;
  /** Records progress (0-99) and the current step, in French, shown to the user. */
  progress(percent: number, step: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** Time spent in this worker invocation, to hand over before the platform time limit. */
  elapsedMs(): number;
}

export interface JobKindDefinition<Input> {
  input: z.ZodType<Input>;
  run(input: Input, ctx: JobContext): Promise<JobResult>;
}

export function defineJobKind<Input>(definition: JobKindDefinition<Input>): JobKindDefinition<Input> {
  return definition;
}
