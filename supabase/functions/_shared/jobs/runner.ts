import type { Services } from "../services/index.ts";
import { JOB_ERROR_MESSAGES, JobError, JobFencedError, toJobError } from "./errors.ts";
import type { AssetDraft, ClaimedJob, DataAccess, JobContext, JobKindDefinition } from "./types.ts";

export interface JobStore {
  /** Throws JobFencedError when the attempt is no longer the active one. */
  setProgress(jobId: string, attempt: number, percent: number, step: string): Promise<void>;
  complete(
    jobId: string,
    attempt: number,
    output: Record<string, unknown>,
    assets: AssetDraft[],
  ): Promise<void>;
  fail(jobId: string, attempt: number, error: JobError, message: string): Promise<void>;
  yieldJob(jobId: string, attempt: number): Promise<void>;
}

export interface RunnerDeps {
  store: JobStore;
  services: Services;
  data: DataAccess;
  // deno-lint-ignore no-explicit-any
  kinds: Record<string, JobKindDefinition<any>>;
  sleep(ms: number): Promise<void>;
  now(): number;
  log(message: string, details?: Record<string, unknown>): void;
}

export type RunOutcome = "completed" | "yielded" | "failed" | "superseded";

export async function runJob(job: ClaimedJob, deps: RunnerDeps): Promise<RunOutcome> {
  const { store } = deps;
  const startedAt = deps.now();
  try {
    const definition = deps.kinds[job.kind];
    if (!definition) throw new JobError("unknown_job_kind", false, job.kind);

    const parsed = definition.input.safeParse(job.input);
    if (!parsed.success) throw new JobError("invalid_input", false, parsed.error.message);

    const ctx: JobContext = {
      jobId: job.id,
      kind: job.kind,
      userId: job.user_id,
      projectId: job.project_id,
      attempt: job.attempts,
      services: deps.services,
      data: deps.data,
      progress: (percent, step) =>
        store.setProgress(job.id, job.attempts, Math.min(99, Math.max(0, Math.round(percent))), step),
      sleep: deps.sleep,
      elapsedMs: () => deps.now() - startedAt,
    };

    const result = await definition.run(parsed.data, ctx);
    if ("continueLater" in result) {
      await store.yieldJob(job.id, job.attempts);
      deps.log("job handed over to a later invocation", { jobId: job.id, attempt: job.attempts });
      return "yielded";
    }
    await store.complete(job.id, job.attempts, result.output, result.assets ?? []);
    return "completed";
  } catch (error) {
    if (error instanceof JobFencedError) {
      deps.log("job attempt superseded, stopping", { jobId: job.id, attempt: job.attempts });
      return "superseded";
    }
    const jobError = toJobError(error);
    deps.log("job attempt failed", {
      jobId: job.id,
      attempt: job.attempts,
      code: jobError.code,
      retryable: jobError.retryable,
      detail: jobError.message,
    });
    try {
      await store.fail(job.id, job.attempts, jobError, JOB_ERROR_MESSAGES[jobError.code]);
    } catch (failError) {
      if (failError instanceof JobFencedError) return "superseded";
      // The stale-job recovery will pick this attempt up.
      deps.log("could not record job failure", { jobId: job.id, detail: String(failError) });
    }
    return "failed";
  }
}
