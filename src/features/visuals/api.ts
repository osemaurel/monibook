import { useQuery } from "@tanstack/react-query";
import { JOB_COLUMNS, type JobView } from "@/features/jobs/jobs-cache";
import { compressCover } from "@/features/projects/cover";
import { uploadUserFile } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { type VisualConcept, type VisualFormat, VISUALS_JOB_KIND, type VisualStyle } from "./config";

export interface VisualAsset {
  id: string;
  jobId: string;
  path: string;
  format: VisualFormat;
  concept: VisualConcept;
  variation: number;
}

export interface VisualBatchInput {
  format: VisualFormat;
  style: VisualStyle;
  headline: string;
  promise?: string;
  price_fcfa?: number;
  benefits: string[];
  call_to_action: string;
  guarantee?: string;
  reference_path?: string;
}

export interface VisualBatch {
  job: JobView;
  input: VisualBatchInput;
  visuals: VisualAsset[];
}

const BATCH_COLUMNS = `${JOB_COLUMNS}, input` as const;

interface AssetRow {
  id: string;
  job_id: string | null;
  storage_path: string | null;
  content: { format?: VisualFormat; concept?: VisualConcept; variation?: number } | null;
}

/** Batches of the project, newest first, each with its visuals once it is done. */
export function useVisualBatches(projectId: string) {
  return useQuery({
    // Under "jobs": refreshed whenever a job of the user changes status.
    queryKey: ["jobs", "visuals", projectId],
    queryFn: async (): Promise<VisualBatch[]> => {
      const [jobs, assets] = await Promise.all([
        supabase
          .from("jobs")
          .select(BATCH_COLUMNS)
          .eq("project_id", projectId)
          .eq("kind", VISUALS_JOB_KIND)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("assets")
          .select("id, job_id, storage_path, content")
          .eq("project_id", projectId)
          .eq("content->>type", "ad_visual")
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      if (jobs.error) throw jobs.error;
      if (assets.error) throw assets.error;

      const byJob = new Map<string, VisualAsset[]>();
      for (const row of assets.data as AssetRow[]) {
        if (!row.job_id || !row.storage_path || !row.content?.format || !row.content.concept) continue;
        const list = byJob.get(row.job_id) ?? [];
        list.push({
          id: row.id,
          jobId: row.job_id,
          path: row.storage_path,
          format: row.content.format,
          concept: row.content.concept,
          variation: row.content.variation ?? list.length + 1,
        });
        byJob.set(row.job_id, list);
      }
      return jobs.data.map(({ input, ...job }) => ({
        job,
        input: input as unknown as VisualBatchInput,
        visuals: (byJob.get(job.id) ?? []).sort((a, b) => a.variation - b.variation),
      }));
    },
  });
}

/** Title of the project's ebook, which the visuals show by default. */
export function useEbookTitle(projectId: string) {
  return useQuery({
    queryKey: ["ebook", "title", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ebooks").select("title").eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      return data?.title ?? null;
    },
  });
}

/** Compresses the reference image on the device, then stores it in the project's reference folder. */
export async function uploadVisualReference(userId: string, projectId: string, file: File): Promise<string> {
  const { blob, extension } = await compressCover(file);
  return uploadUserFile(`${userId}/${projectId}/visuals/references/${crypto.randomUUID()}.${extension}`, blob);
}
