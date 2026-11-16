import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCredits, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { jobKindLabel } from "./job-kinds";
import { isActive, type JobView } from "./jobs-cache";

const STATUS: Record<JobView["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "En attente", variant: "outline" },
  running: { label: "En cours", variant: "secondary" },
  done: { label: "Terminé", variant: "default" },
  failed: { label: "Échec", variant: "destructive" },
};

function stepText(job: JobView): string {
  switch (job.status) {
    case "queued":
      if (job.continuation) return job.step ? `${job.step} (suite)` : "Suite de la génération…";
      return job.attempts === 0
        ? "En attente de démarrage…"
        : `La tentative ${job.attempts} n'a pas abouti. Nouvelle tentative (${job.attempts + 1} sur ${job.max_attempts}) dans quelques secondes…`;
    case "running":
      return job.step ?? "Démarrage…";
    case "done":
      return `Terminé le ${formatDateTime(job.finished_at ?? job.updated_at)} · ${formatCredits(job.credits_reserved)} débités`;
    case "failed":
      return job.error_message ?? "La génération n'a pas abouti.";
  }
}

/** Live status of a generation: status, progress bar, current step, attempts, credits. */
export function JobProgress({ job, href, className }: { job: JobView; href?: string; className?: string }) {
  const status = STATUS[job.status];
  const active = isActive(job);

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3", className)} aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium">
          {href ? <Link to={href} className="underline-offset-4 hover:underline">{jobKindLabel(job.kind)}</Link> : jobKindLabel(job.kind)}
        </p>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {(job.status === "running" || job.status === "done" || job.continuation) && (
        <div className="flex items-center gap-3">
          <Progress value={job.progress} aria-label="Progression" className="h-2" />
          <span className="w-14 shrink-0 text-right text-sm whitespace-nowrap tabular-nums">{job.progress} %</span>
        </div>
      )}

      <p className={cn("text-sm", job.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
        {stepText(job)}
      </p>

      {job.status === "running" && job.attempts > 1 && (
        <p className="text-xs text-muted-foreground">Tentative {job.attempts} sur {job.max_attempts}</p>
      )}
      {job.status === "failed" && (
        <p className="text-sm">Vos {formatCredits(job.credits_reserved)} vous ont été restitués.</p>
      )}
      {active && (
        <p className="text-xs text-muted-foreground">
          {formatCredits(job.credits_reserved)} réservés. Vous pouvez fermer cette page : la génération continue
          et son résultat sera enregistré.
        </p>
      )}
    </div>
  );
}

export function JobOutput({ job }: { job: JobView }) {
  const output = job.output as { text?: unknown } | null;
  if (job.status !== "done" || typeof output?.text !== "string") return null;
  return <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{output.text}</p>;
}
