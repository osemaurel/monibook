import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { jobKindLabel } from "@/features/jobs/job-kinds";
import type { Enums } from "@/lib/database.types";
import { formatCredits, formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useBalance } from "./use-credits";

const PAGE_SIZE = 30;

const OPERATION_LABELS: Record<Enums<"credit_transaction_kind">, string> = {
  grant: "Ajout de crédits",
  reservation: "Réservation",
  debit: "Débit",
  release: "Remboursement",
};

function amountLabel(kind: Enums<"credit_transaction_kind">, amount: number): string {
  if (kind === "debit") return `${formatCredits(Math.abs(amount))} débités`;
  return `${amount > 0 ? "+" : "−"}${formatCredits(Math.abs(amount))}`;
}

export function CreditHistoryPage() {
  const balance = useBalance();
  const history = useInfiniteQuery({
    queryKey: queryKeys.creditHistory,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("credit_history")
        .select("id, created_at, kind, amount, balance_after, job_id, job_kind, project_id, project_name")
        .order("id", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
  });

  const rows = history.data?.pages.flat() ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Historique des crédits</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            {balance.data ? `${formatCredits(balance.data.available)} disponibles` : <Skeleton className="h-6 w-40" />}
          </CardTitle>
          <CardDescription>
            Les crédits sont réservés au lancement d'une génération, débités si elle réussit et remboursés
            si elle échoue.
            {balance.data && balance.data.reserved > 0 && ` ${formatCredits(balance.data.reserved)} actuellement réservés.`}
          </CardDescription>
        </CardHeader>
      </Card>

      {history.isPending && <Skeleton className="h-40 w-full" />}
      {history.isError && <p className="text-sm text-destructive">L'historique n'a pas pu être chargé.</p>}
      {history.isSuccess && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune opération pour le moment.</p>
      )}

      {rows.length > 0 && (
        <Card className="py-0">
          <CardContent className="px-0">
            <ul className="divide-y">
              {rows.map((row) => {
                const kind = row.kind!;
                const amount = Number(row.amount);
                return (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {row.job_kind ? jobKindLabel(row.job_kind) : OPERATION_LABELS.grant}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {OPERATION_LABELS[kind]}
                        {row.project_name && (
                          <>
                            {" · "}
                            <Link to={`/projets/${row.project_id}`} className="underline-offset-4 hover:underline">
                              {row.project_name}
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at!)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "font-medium tabular-nums",
                          amount > 0 && kind !== "debit" && "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {amountLabel(kind, amount)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Solde après : {formatCredits(Number(row.balance_after))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {history.hasNextPage && (
        <Button variant="outline" onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage}>
          {history.isFetchingNextPage ? "Chargement…" : "Afficher les opérations précédentes"}
        </Button>
      )}
    </div>
  );
}
