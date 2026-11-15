import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLaunchRequirements } from "./modules";
import { PROJECT_STATUS_LABELS, type Project } from "./project";
import { ProjectCover } from "./project-cover";
import { describeMissing, missingForLaunch } from "./readiness";

export function ProjectCard({ project }: { project: Project }) {
  const missing = missingForLaunch(project, useLaunchRequirements());

  return (
    <Link
      to={`/projets/${project.id}`}
      className="flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      <ProjectCover path={project.cover_path} className="w-16 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{project.name}</p>
          <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
        </div>
        {project.niche && <p className="truncate text-sm text-muted-foreground">{project.niche}</p>}
        <p className={cn("text-sm", missing.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
          {describeMissing(missing)}
        </p>
        {project.active_jobs > 0 && (
          <p className="text-xs text-muted-foreground">
            {project.active_jobs === 1 ? "1 génération en cours" : `${project.active_jobs} générations en cours`}
          </p>
        )}
      </div>
    </Link>
  );
}
