import { Skeleton } from "@/components/ui/skeleton";
import { formatCredits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CreditCheck } from "./use-credits";

/** Shown next to every paid action, before the user confirms it. */
export function CreditCost({ check, className }: { check: CreditCheck; className?: string }) {
  if (check.loading) return <Skeleton className={cn("h-10 w-full", className)} />;
  if (check.cost === undefined) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm",
        !check.affordable && "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <span>
        Coût : <strong>{formatCredits(check.cost)}</strong>
      </span>
      {check.affordable
        ? (
          <span className="text-muted-foreground">
            Solde après lancement : {formatCredits(check.available - check.cost)}
          </span>
        )
        : (
          <span className="text-destructive">
            Solde insuffisant ({formatCredits(check.available)} disponibles)
          </span>
        )}
    </div>
  );
}
