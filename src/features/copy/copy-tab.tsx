import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveJobProgress } from "@/features/jobs/live-job";
import type { ProjectModule } from "@/features/projects/modules";
import { useCurrentProject } from "@/features/projects/project-context";
import { useActiveCopyJobs, useCopyTexts } from "./api";
import { ALL_COPY_TYPES, COPY_JOB_KINDS } from "./config";

/** Content of the project's Texts tab: saved texts by type and entry point to the texts screen. */
export function CopyTab({ module }: { module: ProjectModule }) {
  const project = useCurrentProject();
  const texts = useCopyTexts(project.id);
  const active = useActiveCopyJobs(project.id, COPY_JOB_KINDS);
  if (texts.isPending) return <Skeleton className="h-32 w-full" />;

  const saved = texts.data ?? [];
  const byType = ALL_COPY_TYPES
    .map((type) => ({ type, count: saved.filter((t) => t.type === type.id).length }))
    .filter((entry) => entry.count > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-medium">{saved.length > 0 ? "Ce module produit :" : "Ce module produira :"}</p>
        <p className="text-muted-foreground">{module.produces}</p>
      </div>
      {(active.data ?? []).map((job) => {
        const type = ALL_COPY_TYPES.find((t) => t.kind === job.kind);
        return <LiveJobProgress key={job.id} job={job} href={`textes?type=${type?.id ?? ""}`} />;
      })}
      {byType.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {saved.length} {saved.length > 1 ? "textes enregistrés" : "texte enregistré"}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {byType.map(({ type, count }) => (
              <Badge key={type.id} variant="secondary" asChild>
                <Link to={`textes?type=${type.id}`}>{type.label} · {count}</Link>
              </Badge>
            ))}
          </div>
        </section>
      )}
      <Button size="lg" asChild>
        <Link to="textes">{saved.length > 0 ? "Voir et rédiger des textes" : "Rédiger des textes"}</Link>
      </Button>
    </div>
  );
}
