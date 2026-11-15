import { toast } from "sonner";
import { useCurrentProject } from "@/features/projects/project-context";
import type { TablesUpdate } from "@/lib/database.types";
import { type Ebook, ebookErrorMessage, useSaveEbook } from "../api";

export interface StepProps {
  ebook: Ebook | null;
  goTo(step: number): void;
}

export interface EbookStepProps {
  ebook: Ebook;
  goTo(step: number): void;
}

/** Saves a validated step and moves on; the database refuses a step whose prerequisites are missing. */
export function useAdvance(ebook: Ebook | null, goTo: (step: number) => void) {
  const project = useCurrentProject();
  const save = useSaveEbook(project.id);

  function advance(patch: TablesUpdate<"ebooks">, nextStep: number) {
    save.mutate(
      { ebook, patch: { ...patch, step: Math.max(ebook?.step ?? 1, nextStep) } },
      {
        onSuccess: () => goTo(nextStep),
        onError: (error) => toast.error(ebookErrorMessage(error)),
      },
    );
  }

  function update(patch: TablesUpdate<"ebooks">) {
    save.mutate({ ebook, patch }, { onError: (error) => toast.error(ebookErrorMessage(error)) });
  }

  return { advance, update, pending: save.isPending };
}
