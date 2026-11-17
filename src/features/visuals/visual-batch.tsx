import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fileSlug } from "@/features/ebook/export-text";
import { JobProgress } from "@/features/jobs/job-progress";
import { isActive } from "@/features/jobs/jobs-cache";
import { LiveJobProgress } from "@/features/jobs/live-job";
import { formatDateTime } from "@/lib/format";
import { downloadStoredFile, useSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { VisualAsset, VisualBatch } from "./api";
import { VISUAL_CONCEPTS, VISUAL_FORMATS, VISUAL_STYLES } from "./config";

function VisualCard({ visual, headline }: { visual: VisualAsset; headline: string }) {
  const url = useSignedUrl(visual.path);
  const [downloading, setDownloading] = useState(false);
  const extension = visual.path.split(".").pop() ?? "png";
  const filename = `${fileSlug(headline)}-${visual.format === "square" ? "carre" : "vertical"}-${visual.variation}.${extension}`;

  async function download() {
    setDownloading(true);
    try {
      await downloadStoredFile(visual.path, filename);
    } catch {
      toast.error("Le téléchargement n'a pas pu démarrer. Vérifiez votre connexion et réessayez.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <figure className="flex flex-col gap-1.5">
      <div className={cn("overflow-hidden rounded-md border bg-muted", VISUAL_FORMATS[visual.format].aspect)}>
        {url.data
          ? <img src={url.data} alt={VISUAL_CONCEPTS[visual.concept]} loading="lazy" className="size-full object-cover" />
          : <Skeleton className="size-full" />}
      </div>
      <figcaption className="text-xs text-muted-foreground">{VISUAL_CONCEPTS[visual.concept]}</figcaption>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={download}
        disabled={downloading}
        aria-label={`Télécharger le visuel ${visual.variation} en haute résolution`}
      >
        <Download /> {downloading ? "Préparation…" : "Télécharger"}
      </Button>
    </figure>
  );
}

/** One batch: live progress while it runs, then its four visuals with full-resolution download. */
export function VisualBatchCard({ batch }: { batch: VisualBatch }) {
  const { job, input, visuals } = batch;
  const format = VISUAL_FORMATS[input.format];
  return (
    <article className="flex flex-col gap-3 rounded-lg border p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-medium">
          {format.label} · {VISUAL_STYLES[input.style].label}
        </p>
        <p className="text-xs text-muted-foreground">{formatDateTime(job.created_at)}</p>
      </header>
      {isActive(job) && <LiveJobProgress job={job} />}
      {job.status === "failed" && <JobProgress job={job} />}
      {job.status === "done" && (
        <div className="grid grid-cols-2 gap-3">
          {visuals.map((visual) => <VisualCard key={visual.id} visual={visual} headline={input.headline} />)}
        </div>
      )}
    </article>
  );
}
