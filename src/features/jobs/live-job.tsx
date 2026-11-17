import { JobProgress } from "./job-progress";
import type { JobView } from "./jobs-cache";
import { useJob } from "./use-job";

/** Progress of one job, kept live by Realtime (with a polling safety net). */
export function LiveJobProgress({ job, href, className }: { job: JobView; href?: string; className?: string }) {
  const live = useJob(job.id);
  return <JobProgress job={live.data ?? job} href={href} className={className} />;
}
