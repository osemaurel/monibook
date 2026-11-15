import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBalance } from "@/features/credits/use-credits";
import { JobProgress } from "@/features/jobs/job-progress";
import type { JobView } from "@/features/jobs/jobs-cache";
import { useJob } from "@/features/jobs/use-job";
import { useActiveJobs } from "@/features/jobs/use-jobs";
import { ProjectCard } from "@/features/projects/project-card";
import { useProjects, useProjectsInProgressCount } from "@/features/projects/use-projects";
import { formatCredits, formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

function Counter({ label, value, href }: { label: string; value: string | undefined; href?: string }) {
  const content = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      {value === undefined ? <Skeleton className="h-6 w-12" /> : <span className="text-lg font-semibold tabular-nums">{value}</span>}
    </>
  );
  const className = "flex flex-col gap-1 rounded-xl border bg-card p-3";
  return href
    ? <Link to={href} className={cn(className, "hover:bg-muted/50")}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function LiveJob({ job, projectName }: { job: JobView; projectName?: string }) {
  const live = useJob(job.id);
  const current = live.data ?? job;
  return (
    <div className="flex flex-col gap-1">
      {projectName && <p className="text-xs text-muted-foreground">{projectName}</p>}
      <JobProgress job={current} href={`/projets/${current.project_id}/generations/${current.id}`} />
    </div>
  );
}

export function DashboardPage() {
  const projects = useProjects();
  const inProgressCount = useProjectsInProgressCount();
  const activeJobs = useActiveJobs();
  const balance = useBalance();

  const inProgress = projects.data?.filter((p) => p.status === "draft" || p.status === "in_progress") ?? [];
  const current = inProgress[0];
  const projectNames = new Map(projects.data?.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Tableau de bord</h1>

      <div className="grid grid-cols-3 gap-2">
        <Counter label="Projets en cours" value={inProgressCount.data?.toString()} href="/projets" />
        <Counter label="Générations en cours" value={activeJobs.data ? formatInteger(activeJobs.data.count) : undefined} />
        <Counter label="Solde" value={balance.data ? formatCredits(balance.data.available) : undefined} href="/credits" />
      </div>

      {projects.isSuccess && (
        <div className="flex flex-col gap-2">
          {current
            ? (
              <>
                <Button size="lg" asChild>
                  <Link to={`/projets/${current.id}`}>Continuer « {current.name} »</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/projets/nouveau">Nouveau projet</Link>
                </Button>
              </>
            )
            : (
              <Button size="lg" asChild>
                <Link to="/projets/nouveau">{projects.data.length === 0 ? "Créer mon premier projet" : "Nouveau projet"}</Link>
              </Button>
            )}
        </div>
      )}

      <section id="generations" className="flex flex-col gap-3">
        <h2 className="font-medium">Générations en cours</h2>
        {activeJobs.isPending && <Skeleton className="h-20 w-full" />}
        {activeJobs.data?.jobs.length === 0 && <p className="text-sm text-muted-foreground">Aucune génération en cours.</p>}
        {activeJobs.data?.jobs.map((job) => <LiveJob key={job.id} job={job} projectName={projectNames.get(job.project_id)} />)}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Projets en cours</h2>
          {inProgress.length > 3 && <Link to="/projets" className="text-sm underline underline-offset-4">Tout voir</Link>}
        </div>
        {projects.isPending && <Skeleton className="h-24 w-full" />}
        {projects.isSuccess && inProgress.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun projet en cours.</p>
        )}
        {inProgress.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} />)}
      </section>
    </div>
  );
}
