import { Skeleton } from "@/components/ui/skeleton";
import { JobOutput, JobProgress } from "@/features/jobs/job-progress";
import { isActive, type JobView } from "@/features/jobs/jobs-cache";
import { useJob } from "@/features/jobs/use-job";
import { useProjectJobs } from "@/features/jobs/use-jobs";
import type { ProjectModule } from "./modules";
import { useCurrentProject } from "./project-context";

function JobCard({ job }: { job: JobView }) {
  return (
    <div className="flex flex-col gap-2">
      <JobProgress job={job} href={`/projets/${job.project_id}/generations/${job.id}`} />
      <JobOutput job={job} />
    </div>
  );
}

function LiveJob({ job }: { job: JobView }) {
  const live = useJob(job.id);
  return <JobCard job={live.data ?? job} />;
}

export function ModuleTab({ module }: { module: ProjectModule }) {
  const project = useCurrentProject();
  const jobs = useProjectJobs(project.id);
  const Launcher = module.Launcher!;

  const moduleJobs = jobs.data?.filter((job) => job.kind === module.jobKind) ?? [];
  const active = moduleJobs.filter(isActive);
  const finished = moduleJobs.filter((job) => !isActive(job));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-medium">{moduleJobs.length === 0 ? "Ce module produira :" : "Ce module produit :"}</p>
        <p className="text-muted-foreground">{module.produces}</p>
      </div>

      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">En cours</h3>
          {active.map((job) => <LiveJob key={job.id} job={job} />)}
        </section>
      )}

      <Launcher module={module} />

      {jobs.isPending && <Skeleton className="h-20 w-full" />}
      {finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Générations précédentes</h3>
          {finished.map((job) => <JobCard key={job.id} job={job} />)}
        </section>
      )}
    </div>
  );
}
