import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { JOB_COLUMNS, type JobView } from "@/features/jobs/jobs-cache";
import type { Tables, TablesUpdate } from "@/lib/database.types";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

export type Ebook = Tables<"ebooks">;
export type Chapter = Tables<"ebook_chapters">;

const DB_MESSAGES: Record<string, string> = {
  ebook_step_incomplete: "Complétez cette étape avant de passer à la suivante.",
  ebook_locked: "La rédaction a commencé : ces informations ne peuvent plus être modifiées.",
  invalid_cover: "Cette couverture est introuvable. Choisissez une des propositions.",
  invalid_chapter_order: "L'ordre des chapitres n'a pas pu être enregistré. Rechargez la page.",
};

export function ebookErrorMessage(error: unknown): string {
  const message = (error as { message?: string })?.message ?? "";
  const known = Object.keys(DB_MESSAGES).find((code) => message.includes(code));
  return known ? DB_MESSAGES[known] : "L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez.";
}

/** The project's ebook (one per project), kept live through Realtime. */
export function useEbook(projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.projectEbook(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("ebooks").select("*").eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`ebook:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ebooks", filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          queryClient.setQueryData(queryKeys.projectEbook(projectId), payload.new as Ebook);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") queryClient.invalidateQueries({ queryKey: queryKeys.projectEbook(projectId) });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  return query;
}

function byPosition(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => a.position - b.position);
}

/** Chapters in order. Rows pushed by Realtime are merged one by one: the whole book is not reloaded. */
export function useChapters(ebookId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.ebookChapters(ebookId ?? ""),
    enabled: !!ebookId,
    queryFn: async () => {
      const { data, error } = await supabase.from("ebook_chapters").select("*").eq("ebook_id", ebookId!).order("position");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!ebookId) return;
    const key = queryKeys.ebookChapters(ebookId);
    const channel = supabase
      .channel(`ebook-chapters:${ebookId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ebook_chapters", filter: `ebook_id=eq.${ebookId}` },
        (payload) => {
          queryClient.setQueryData<Chapter[]>(key, (current) => {
            if (!current) return current;
            if (payload.eventType === "DELETE") return current.filter((c) => c.id !== (payload.old as Chapter).id);
            const row = payload.new as Chapter;
            return byPosition([...current.filter((c) => c.id !== row.id), row]);
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") queryClient.invalidateQueries({ queryKey: key });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ebookId, queryClient]);

  return query;
}

export function useSaveEbook(projectId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.projectEbook(projectId);
  return useMutation({
    mutationFn: async (args: { ebook: Ebook | null; patch: TablesUpdate<"ebooks"> }) => {
      if (!args.ebook) {
        const { data, error } = await supabase
          .from("ebooks")
          .insert({ project_id: projectId, subject: args.patch.subject, template: args.patch.template, step: args.patch.step })
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("ebooks").update(args.patch).eq("id", args.ebook.id).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (ebook) => queryClient.setQueryData(key, ebook),
  });
}

export function useChapterMutations(ebookId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.ebookChapters(ebookId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const update = useMutation({
    mutationFn: async (args: { id: string; patch: TablesUpdate<"ebook_chapters"> }) => {
      const { error } = await supabase.from("ebook_chapters").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const add = useMutation({
    mutationFn: async (args: { title: string; brief?: string }) => {
      const chapters = queryClient.getQueryData<Chapter[]>(key) ?? [];
      const position = chapters.reduce((max, c) => Math.max(max, c.position), 0) + 1;
      const { data, error } = await supabase
        .from("ebook_chapters")
        .insert({ ebook_id: ebookId, position, title: args.title, brief: args.brief ?? null })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ebook_chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabase.rpc("reorder_ebook_chapters", { p_ebook_id: ebookId, p_chapter_ids: orderedIds });
      if (error) throw error;
    },
    onMutate: (orderedIds) => {
      const current = queryClient.getQueryData<Chapter[]>(key) ?? [];
      queryClient.setQueryData(
        key,
        orderedIds.map((id, i) => ({ ...current.find((c) => c.id === id)!, position: i + 1 })),
      );
    },
    onSettled: refresh,
  });

  /** Moves a chapter one place up (-1) or down (+1). */
  function move(chapters: Chapter[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const ids = chapters.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  return { update, add, remove, reorder, move };
}

/** Latest generation of the given kinds for this ebook (optionally for one chapter). */
export function useEbookJob(ebookId: string, kinds: string[], chapterId?: string) {
  return useQuery({
    queryKey: queryKeys.ebookJob(ebookId, [...kinds, chapterId ?? ""].join(",")),
    queryFn: async (): Promise<JobView | null> => {
      let query = supabase
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("input->>ebook_id", ebookId)
        .in("kind", kinds);
      if (chapterId) query = query.eq("input->>chapter_id", chapterId);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Cover artworks generated for this project, newest first. */
export function useCoverProposals(projectId: string) {
  return useQuery({
    queryKey: queryKeys.coverProposals(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, storage_path, created_at")
        .eq("project_id", projectId)
        .eq("kind", "image")
        .like("storage_path", "%/ebook/covers/%")
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) throw error;
      return data.filter((a): a is typeof a & { storage_path: string } => !!a.storage_path);
    },
  });
}
