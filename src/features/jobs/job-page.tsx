import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/features/projects/project-context";
import { formatDateTime } from "@/lib/format";
import { JobOutput, JobProgress } from "./job-progress";
import { useJob } from "./use-job";

export function JobPage() {
  const { jobId } = useParams();
  const project = useCurrentProject();
  const job = useJob(jobId!);

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/projets/${project.id}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {project.name}
      </Link>

      {job.isPending && <Skeleton className="h-32 w-full" />}
      {job.isSuccess && !job.data && <p className="text-sm text-muted-foreground">Cette génération est introuvable.</p>}
      {job.data && (
        <>
          <h1 className="text-xl font-semibold">Génération du {formatDateTime(job.data.created_at)}</h1>
          <JobProgress job={job.data} />
          <JobOutput job={job.data} />
        </>
      )}
    </div>
  );
}
