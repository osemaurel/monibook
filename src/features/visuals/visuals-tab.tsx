import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isActive } from "@/features/jobs/jobs-cache";
import { LiveJobProgress } from "@/features/jobs/live-job";
import type { ProjectModule } from "@/features/projects/modules";
import { useCurrentProject } from "@/features/projects/project-context";
import { useSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useVisualBatches, type VisualAsset } from "./api";
import { VISUAL_CONCEPTS, VISUAL_FORMATS } from "./config";

function Thumbnail({ visual }: { visual: VisualAsset }) {
  const url = useSignedUrl(visual.path);
  return (
    <div className={cn("overflow-hidden rounded-md border bg-muted", VISUAL_FORMATS[visual.format].aspect)}>
      {url.data && <img src={url.data} alt={VISUAL_CONCEPTS[visual.concept]} loading="lazy" className="size-full object-cover" />}
    </div>
  );
}

/** Content of the project's Visuals tab: latest batch and entry point to the visuals screen. */
export function VisualsTab({ module }: { module: ProjectModule }) {
  const project = useCurrentProject();
  const batches = useVisualBatches(project.id);
  if (batches.isPending) return <Skeleton className="h-32 w-full" />;

  const list = batches.data ?? [];
  const active = list.filter((b) => isActive(b.job));
  const latestDone = list.find((b) => b.job.status === "done");
  const total = list.filter((b) => b.job.status === "done").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-medium">{total > 0 ? "Ce module produit :" : "Ce module produira :"}</p>
        <p className="text-muted-foreground">{module.produces}</p>
      </div>
      {active.map((batch) => <LiveJobProgress key={batch.job.id} job={batch.job} href="visuels" />)}
      {latestDone && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Dernier lot · {total} {total > 1 ? "lots réalisés" : "lot réalisé"}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {latestDone.visuals.map((visual) => <Thumbnail key={visual.id} visual={visual} />)}
          </div>
        </section>
      )}
      <Button size="lg" asChild>
        <Link to="visuels">{total > 0 || active.length > 0 ? "Voir et créer des visuels" : "Créer des visuels"}</Link>
      </Button>
    </div>
  );
}
