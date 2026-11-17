import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { JOB_COLUMNS, type JobView } from "@/features/jobs/jobs-cache";
import type { Tables } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import type { CopyAngle, CopyType } from "./config";

export type CopyText = Tables<"copy_texts">;

const copyTextsKey = (projectId: string) => ["copy-texts", projectId] as const;

/** Latest generations of one type of copy, newest first (their variations are in the output). */
export function useCopyJobs(projectId: string, kind: string | undefined) {
  return useQuery({
    // Under "jobs": refreshed whenever a job of the user changes status.
    queryKey: ["jobs", "copy", projectId, kind ?? ""],
    enabled: !!kind,
    queryFn: async (): Promise<JobView[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("project_id", projectId)
        .eq("kind", kind!)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });
}

/** Active copy generations of the project, whatever their type. */
export function useActiveCopyJobs(projectId: string, kinds: string[]) {
  return useQuery({
    queryKey: ["jobs", "copy-active", projectId],
    queryFn: async (): Promise<JobView[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("project_id", projectId)
        .in("kind", kinds)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCopyTexts(projectId: string) {
  return useQuery({
    queryKey: copyTextsKey(projectId),
    queryFn: async (): Promise<CopyText[]> => {
      const { data, error } = await supabase
        .from("copy_texts")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCopyTextMutations(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: copyTextsKey(projectId) });

  const save = useMutation({
    mutationFn: async (text: {
      jobId: string | null;
      type: CopyType;
      angle: CopyAngle | null;
      title: string;
      content: string;
    }) => {
      const { error } = await supabase.from("copy_texts").insert({
        project_id: projectId,
        job_id: text.jobId,
        type: text.type,
        angle: text.angle,
        title: text.title.trim(),
        content: text.content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("copy_texts")
        .update({ title: args.title.trim(), content: args.content.trim() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("copy_texts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return { save, update, remove };
}
