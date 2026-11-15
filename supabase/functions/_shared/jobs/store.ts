import type { SupabaseClient } from "../deps.ts";
import { sqlErrorCode } from "../supabase.ts";
import { JOB_ERROR_MESSAGES, JobFencedError } from "./errors.ts";
import type { JobStore } from "./runner.ts";
import { ClaimedJob } from "./types.ts";

async function call(admin: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    if (sqlErrorCode(error) === "job_not_active") throw new JobFencedError();
    throw new Error(`${fn} failed: ${error.message}`);
  }
  return data;
}

export function createSupabaseJobStore(admin: SupabaseClient): JobStore {
  return {
    async setProgress(jobId, attempt, percent, step) {
      await call(admin, "set_job_progress", {
        p_job_id: jobId,
        p_attempt: attempt,
        p_progress: percent,
        p_step: step,
      });
    },
    async complete(jobId, attempt, output, assets) {
      await call(admin, "complete_job", {
        p_job_id: jobId,
        p_attempt: attempt,
        p_output: output,
        p_assets: assets,
      });
    },
    async fail(jobId, attempt, error, message) {
      await call(admin, "fail_job", {
        p_job_id: jobId,
        p_attempt: attempt,
        p_error_code: error.code,
        p_error_message: message,
        p_retryable: error.retryable,
      });
    },
    async yieldJob(jobId, attempt) {
      await call(admin, "yield_job", { p_job_id: jobId, p_attempt: attempt });
    },
  };
}

/** Asks the database to call job-run now rather than at the next cron tick. */
export async function kickRunner(admin: SupabaseClient): Promise<void> {
  await call(admin, "kick_job_runner", {});
}

export async function claimJobs(admin: SupabaseClient, limit: number): Promise<ClaimedJob[]> {
  const rows = await call(admin, "claim_jobs", { p_limit: limit });
  return ClaimedJob.array().parse(rows ?? []);
}

export async function recoverStaleJobs(admin: SupabaseClient): Promise<number> {
  const count = await call(admin, "recover_stale_jobs", {
    p_error_code: "job_timeout",
    p_error_message: JOB_ERROR_MESSAGES.job_timeout,
  });
  return Number(count ?? 0);
}

export async function verifyRunnerSecret(admin: SupabaseClient, secret: string): Promise<boolean> {
  return (await call(admin, "verify_job_runner_secret", { p_secret: secret })) === true;
}
