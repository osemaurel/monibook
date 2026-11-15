import type { QueryClient } from "@tanstack/react-query";
import type { Tables } from "@/lib/database.types";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

export type Job = Tables<"jobs">;

export const JOB_COLUMNS =
  "id, project_id, kind, status, progress, step, attempts, max_attempts, credits_reserved, output, error_message, created_at, started_at, finished_at, updated_at, run_after";

export type JobView = Pick<
  Job,
  | "id"
  | "project_id"
  | "kind"
  | "status"
  | "progress"
  | "step"
  | "attempts"
  | "max_attempts"
  | "credits_reserved"
  | "output"
  | "error_message"
  | "created_at"
  | "started_at"
  | "finished_at"
  | "updated_at"
  | "run_after"
>;

export function isActive(job: Pick<Job, "status"> | undefined | null): boolean {
  return job?.status === "queued" || job?.status === "running";
}

export async function fetchJob(jobId: string): Promise<JobView | null> {
  const { data, error } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", jobId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Applies a row pushed by Realtime; refreshes what depends on the job when its status changes. */
export function applyJobChange(queryClient: QueryClient, job: JobView) {
  const previous = queryClient.getQueryData<JobView | null>(queryKeys.job(job.id));
  queryClient.setQueryData(queryKeys.job(job.id), job);
  if (previous?.status !== job.status) invalidateJobDependents(queryClient);
}

export function invalidateJobDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
  queryClient.invalidateQueries({ queryKey: queryKeys.balance });
  queryClient.invalidateQueries({ queryKey: queryKeys.creditHistory });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects });
}
