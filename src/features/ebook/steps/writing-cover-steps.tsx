import { Check, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/features/projects/project-context";
import { formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Chapter, useChapters, useCoverProposals } from "../api";
import { CoverArt, GenerateAction, StepSection } from "../components";
import { LENGTHS } from "../config";
import { type EbookStepProps, useAdvance } from "./shared";

function ChapterStatus({ chapter }: { chapter: Chapter }) {
  if (chapter.status === "written") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <Check className="size-4" aria-hidden /> {formatInteger(chapter.word_count)} mots
      </span>
    );
  }
  if (chapter.status === "writing") {
    return (
      <span className="flex items-center gap-1 text-xs">
        <Loader2 className="size-4 animate-spin" aria-hidden /> En cours de rédaction
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Circle className="size-4" aria-hidden /> En attente
    </span>
  );
}

export function WritingStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const chapters = useChapters(ebook.id);
  const { advance, pending } = useAdvance(ebook, goTo);
  const list = chapters.data ?? [];
  const written = list.filter((c) => c.status === "written").length;
  const words = list.reduce((sum, c) => sum + c.word_count, 0);
  const kind = ebook.length ? LENGTHS[ebook.length].writeKind : null;

  return (
    <StepSection
      title="Rédaction"
      description="Monibook prépare la bible du livre, rédige chaque chapitre avec elle et le résumé des chapitres précédents, puis vérifie la cohérence de l'ensemble."
    >
      {ebook.written_at
        ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            Votre ebook est rédigé : {list.length} chapitres, {formatInteger(words)} mots.
          </p>
        )
        : kind && (
          <GenerateAction
            kind={kind}
            ebookId={ebook.id}
            projectId={project.id}
            input={{ ebook_id: ebook.id }}
            label="Rédiger l'ebook"
            hint="Vous pouvez fermer cette page : la rédaction continue et chaque chapitre est enregistré dès qu'il est écrit."
          />
        )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{written} chapitre{written > 1 ? "s" : ""} rédigé{written > 1 ? "s" : ""} sur {list.length}</p>
        {chapters.isPending && <Skeleton className="h-32 w-full" />}
        <ol className="flex flex-col divide-y rounded-lg border">
          {list.map((chapter, index) => (
            <li
              key={chapter.id}
              className={cn("flex items-center justify-between gap-3 px-3 py-2.5", chapter.status === "writing" && "bg-muted/60")}
            >
              <span className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground tabular-nums">{index + 1}. </span>
                {chapter.title}
              </span>
              <span className="shrink-0"><ChapterStatus chapter={chapter} /></span>
            </li>
          ))}
        </ol>
      </div>

      {ebook.written_at && (
        <Button size="lg" disabled={pending} onClick={() => (ebook.step >= 7 ? goTo(7) : advance({}, 7))}>
          Continuer vers la couverture
        </Button>
      )}
    </StepSection>
  );
}

export function CoverStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const proposals = useCoverProposals(project.id);
  const [selected, setSelected] = useState(ebook.cover_path);
  const { advance, pending } = useAdvance(ebook, goTo);
  const list = proposals.data ?? [];

  return (
    <StepSection
      title="Couverture"
      description="Choisissez une illustration. Le titre et le nom de l'auteur sont composés par-dessus, comme dans le PDF."
    >
      <GenerateAction
        kind="ebook_cover"
        ebookId={ebook.id}
        projectId={project.id}
        input={{ ebook_id: ebook.id }}
        label={list.length > 0 ? "Générer 3 nouvelles propositions" : "Générer 3 propositions"}
      />
      {proposals.isPending && <Skeleton className="h-48 w-full" />}
      {list.length > 0 && (
        <div role="radiogroup" aria-label="Propositions de couverture" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((proposal, index) => (
            <button
              key={proposal.id}
              type="button"
              role="radio"
              aria-checked={selected === proposal.storage_path}
              aria-label={`Couverture ${index + 1}`}
              onClick={() => setSelected(proposal.storage_path)}
              className={cn(
                "rounded-lg p-1 text-[14px] ring-2 ring-offset-2 ring-offset-background",
                selected === proposal.storage_path ? "ring-foreground" : "ring-transparent",
              )}
            >
              <CoverArt
                path={proposal.storage_path}
                title={ebook.title ?? ""}
                subtitle={ebook.subtitle}
                author={ebook.author_name}
              />
            </button>
          ))}
        </div>
      )}
      <Button size="lg" disabled={!selected || pending} onClick={() => advance({ cover_path: selected }, 8)}>
        Valider cette couverture
      </Button>
    </StepSection>
  );
}
