import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { applyJobChange, fetchJob, isActive, type JobView } from "./jobs-cache";

// Safety net when the Realtime connection drops on a weak network.
const ACTIVE_POLL_MS = 15_000;

/**
 * Follows one job: initial read from the database, then live updates of its row via Realtime.
 * The job lives server-side, so closing the page and coming back shows its real state.
 */
export function useJob(jobId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.job(jobId),
    queryFn: () => fetchJob(jobId),
    refetchInterval: (q) => (isActive(q.state.data) ? ACTIVE_POLL_MS : false),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => applyJobChange(queryClient, payload.new as JobView),
      )
      .subscribe((status) => {
        // Catch up on anything that happened before the subscription was ready.
        if (status === "SUBSCRIBED") queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  return query;
}
