import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "@/features/auth/auth-provider";
import type { TablesUpdate } from "@/lib/database.types";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { removeCover, uploadCover } from "./cover";
import { PROJECT_OVERVIEW_COLUMNS, type Project, type ProjectLanguage, type ProjectStatus, toProject } from "./project";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_overview")
        .select(PROJECT_OVERVIEW_COLUMNS)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data.map(toProject);
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_overview")
        .select(PROJECT_OVERVIEW_COLUMNS)
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data ? toProject(data) : null;
    },
  });
}

/** Counted by the database on real rows, never estimated. */
export function useProjectsInProgressCount() {
  return useQuery({
    queryKey: queryKeys.projectsInProgressCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["draft", "in_progress"]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface ProjectFields {
  name: string;
  niche: string | null;
  angle: string | null;
  audience: string | null;
  promise: string | null;
  planned_price_fcfa: number | null;
  language: ProjectLanguage;
  status: ProjectStatus;
}

export type CoverChange = { type: "keep" } | { type: "replace"; file: File } | { type: "remove" };

export interface SaveProjectResult {
  projectId: string;
  coverFailed: boolean;
}

export function useSaveProject() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      project?: Project;
      fields: ProjectFields;
      cover: CoverChange;
    }): Promise<SaveProjectResult> => {
      let projectId = args.project?.id;
      if (projectId) {
        const { error } = await supabase.from("projects").update(args.fields).eq("id", projectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("projects").insert(args.fields).select("id").single();
        if (error) throw error;
        projectId = data.id;
      }

      const previousCover = args.project?.cover_path ?? null;
      if (args.cover.type === "keep") return { projectId, coverFailed: false };

      try {
        const patch: TablesUpdate<"projects"> = {
          cover_path: args.cover.type === "replace" ? await uploadCover(userId, projectId, args.cover.file) : null,
        };
        const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
        if (error) throw error;
        if (previousCover) await removeCover(previousCover);
        return { projectId, coverFailed: false };
      } catch {
        return { projectId, coverFailed: true };
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}
