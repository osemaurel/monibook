import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useUserId } from "@/features/auth/auth-provider";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { applyJobChange, invalidateJobDependents, JOB_COLUMNS, type JobView } from "./jobs-cache";

export function useProjectJobs(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectJobs(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveJobs() {
  return useQuery({
    queryKey: queryKeys.activeJobs,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("jobs")
        .select(JOB_COLUMNS, { count: "exact" })
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return { jobs: data, count: count ?? data.length };
    },
  });
}

/** One channel for all the user's jobs: keeps lists, balance and counters in sync. */
export function useJobsFeed() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`jobs-feed:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") invalidateJobDependents(queryClient);
          else if (payload.eventType === "UPDATE") applyJobChange(queryClient, payload.new as JobView);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error?.message === "string") return body.error.message;
    } catch {
      // Not a JSON body: fall through to the generic message.
    }
  }
  if (error instanceof FunctionsFetchError) {
    return "Connexion impossible. Vérifiez votre connexion internet puis réessayez.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { kind: string; projectId: string; input: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke<{ job_id: string }>("job-create", {
        body: { kind: args.kind, project_id: args.projectId, input: args.input },
      });
      if (error || !data) throw new Error(await functionErrorMessage(error));
      return data.job_id;
    },
    onSettled: () => invalidateJobDependents(queryClient),
  });
}
