import { z } from "../_shared/deps.ts";
import { errorResponse, json, readJson } from "../_shared/http.ts";
import type { RunOutcome } from "../_shared/jobs/runner.ts";
import type { ClaimedJob } from "../_shared/jobs/types.ts";

export const MAX_JOBS_PER_RUN = 5;

const Body = z.strictObject({});

export interface JobRunDeps {
  verifySecret(secret: string): Promise<boolean>;
  recoverStaleJobs(): Promise<number>;
  claimJobs(limit: number): Promise<ClaimedJob[]>;
  runJob(job: ClaimedJob): Promise<RunOutcome>;
  /** Starts the next worker invocation, used when a long job handed over. */
  kick(): Promise<void>;
  /** Keeps the worker alive after the response so cron's short HTTP timeout is not an issue. */
  waitUntil(work: Promise<unknown>): void;
}

export function createJobRunHandler(deps: JobRunDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Méthode non autorisée.");

    const secret = req.headers.get("x-job-runner-secret");
    if (!secret || !(await deps.verifySecret(secret))) {
      return errorResponse(401, "unauthorized", "Accès refusé.");
    }

    if (!Body.safeParse(await readJson(req)).success) {
      return errorResponse(400, "invalid_request", "La demande envoyée est invalide.");
    }

    const recovered = await deps.recoverStaleJobs();
    const jobs = await deps.claimJobs(MAX_JOBS_PER_RUN);
    if (jobs.length > 0) {
      deps.waitUntil(
        Promise.allSettled(jobs.map((job) => deps.runJob(job))).then(async (results) => {
          if (results.some((r) => r.status === "fulfilled" && r.value === "yielded")) await deps.kick();
        }),
      );
    }
    return json({ recovered, claimed: jobs.length }, 202);
  };
}
