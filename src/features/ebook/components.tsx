import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCost } from "@/features/credits/credit-cost";
import { useCreditCheck } from "@/features/credits/use-credits";
import { JobProgress } from "@/features/jobs/job-progress";
import { isActive, type JobView } from "@/features/jobs/jobs-cache";
import { useJob } from "@/features/jobs/use-job";
import { useCreateJob } from "@/features/jobs/use-jobs";
import { useCoverUrl } from "@/features/projects/cover";
import { formatCredits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEbookJob } from "./api";
import { STEPS } from "./config";

function LiveJobProgress({ job }: { job: JobView }) {
  const live = useJob(job.id);
  return <JobProgress job={live.data ?? job} />;
}

/**
 * Launches one generation for the ebook: shows its cost first, then follows the job live.
 * The result itself arrives in the ebook or its chapters, written by the server.
 */
export function GenerateAction({ kind, ebookId, projectId, input, label, hint, chapterId, disabled }: {
  kind: string;
  ebookId: string;
  projectId: string;
  input: Record<string, unknown>;
  label: string;
  hint?: string;
  chapterId?: string;
  disabled?: boolean;
}) {
  const check = useCreditCheck(kind);
  const latest = useEbookJob(ebookId, [kind], chapterId);
  const createJob = useCreateJob();
  const job = latest.data;
  const running = isActive(job);
  // A failure is only shown until something else is launched.
  const showFailure = job?.status === "failed";

  if (check.cost === undefined && !check.loading) return null;

  function launch() {
    createJob.mutate(
      { kind, projectId, input },
      { onError: (error) => toast.error(error.message) },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {job && (running || showFailure) && <LiveJobProgress job={job} />}
      {!running && (
        <>
          <CreditCost check={check} />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <Button
            type="button"
            variant="secondary"
            onClick={launch}
            disabled={disabled || !check.affordable || createJob.isPending}
          >
            {createJob.isPending ? "Lancement…" : `${label}${check.cost !== undefined ? ` · ${formatCredits(check.cost)}` : ""}`}
          </Button>
        </>
      )}
    </div>
  );
}

/** Cover artwork with the title typeset over it, as on the PDF cover. */
export function CoverArt({ path, title, subtitle, author, className }: {
  path: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  className?: string;
}) {
  const url = useCoverUrl(path);
  return (
    <div className={cn("relative aspect-[148/210] overflow-hidden rounded-md bg-neutral-800 text-white", className)}>
      {url.data && <img src={url.data} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-x-[9%] top-[11%] [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
        <p className="text-[0.95em] leading-tight font-bold">{title}</p>
        {subtitle && <p className="mt-1 text-[0.6em] leading-snug">{subtitle}</p>}
      </div>
      {author && (
        <p className="absolute inset-x-[9%] bottom-[8%] text-[0.5em] tracking-wider uppercase [text-shadow:0_1px_6px_rgba(0,0,0,.4)]">
          {author}
        </p>
      )}
    </div>
  );
}

export function EbookStepper({ reached, current, onSelect }: {
  reached: number;
  current: number;
  onSelect(step: number): void;
}) {
  return (
    <nav aria-label="Étapes de l'ebook" className="-mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max gap-1.5">
        {STEPS.map((label, i) => {
          const step = i + 1;
          const available = step <= reached;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!available}
                onClick={() => onSelect(step)}
                aria-current={step === current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap",
                  step === current && "border-foreground bg-foreground text-background",
                  step !== current && available && "bg-card",
                  !available && "opacity-40",
                )}
              >
                {step < reached && step !== current ? <Check className="size-3" aria-hidden /> : <span>{step}</span>}
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepSection({ title, description, children }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function LockedNotice() {
  return (
    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
      La rédaction a commencé : cette étape est figée. Les chapitres se modifient dans l'éditeur.
    </p>
  );
}
