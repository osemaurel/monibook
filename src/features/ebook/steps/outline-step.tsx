import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentProject } from "@/features/projects/project-context";
import { type Chapter, ebookErrorMessage, useChapterMutations, useChapters } from "../api";
import { GenerateAction, LockedNotice, StepSection } from "../components";
import { LENGTHS } from "../config";
import { type EbookStepProps, useAdvance } from "./shared";

function OutlineItem({ chapter, index, total, locked, mutations, chapters }: {
  chapter: Chapter;
  index: number;
  total: number;
  locked: boolean;
  mutations: ReturnType<typeof useChapterMutations>;
  chapters: Chapter[];
}) {
  const [title, setTitle] = useState(chapter.title);
  const [brief, setBrief] = useState(chapter.brief ?? "");

  useEffect(() => {
    setTitle(chapter.title);
    setBrief(chapter.brief ?? "");
  }, [chapter.title, chapter.brief]);

  function save() {
    const patch = {
      ...(title.trim() && title.trim() !== chapter.title ? { title: title.trim() } : {}),
      ...(brief.trim() !== (chapter.brief ?? "") ? { brief: brief.trim() || null } : {}),
    };
    if (Object.keys(patch).length === 0) return setTitle(chapter.title);
    mutations.update.mutate({ id: chapter.id, patch }, { onError: (e) => toast.error(ebookErrorMessage(e)) });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
        <Input
          aria-label={`Titre du chapitre ${index + 1}`}
          value={title}
          maxLength={200}
          readOnly={locked}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
        />
      </div>
      <Textarea
        aria-label={`Contenu prévu du chapitre ${index + 1}`}
        rows={2}
        maxLength={2000}
        value={brief}
        readOnly={locked}
        placeholder="Ce que le chapitre doit couvrir"
        onChange={(e) => setBrief(e.target.value)}
        onBlur={save}
      />
      {!locked && (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Monter" disabled={index === 0} onClick={() => mutations.move(chapters, index, -1)}>
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Descendre"
            disabled={index === total - 1}
            onClick={() => mutations.move(chapters, index, 1)}
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Supprimer ce chapitre" onClick={() => mutations.remove.mutate(chapter.id)}>
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
}

export function OutlineStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const locked = !!ebook.bible;
  const chapters = useChapters(ebook.id);
  const mutations = useChapterMutations(ebook.id);
  const { advance, pending } = useAdvance(ebook, goTo);
  const [newTitle, setNewTitle] = useState("");
  const list = chapters.data ?? [];
  const range = ebook.length ? LENGTHS[ebook.length].chapters : null;

  function add(event: FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    mutations.add.mutate({ title: newTitle.trim() }, {
      onSuccess: () => setNewTitle(""),
      onError: (e) => toast.error(ebookErrorMessage(e)),
    });
  }

  return (
    <StepSection
      title="Plan"
      description="Le plan proposé suit votre gabarit. Renommez, réordonnez, ajoutez ou supprimez des chapitres."
    >
      {locked ? <LockedNotice /> : (
        <GenerateAction
          kind="ebook_outline"
          ebookId={ebook.id}
          projectId={project.id}
          input={{ ebook_id: ebook.id }}
          label={list.length > 0 ? "Proposer un nouveau plan" : "Proposer le plan"}
          hint={list.length > 0 ? "Un nouveau plan remplace entièrement le plan ci-dessous." : undefined}
        />
      )}
      {range && (
        <p className="text-xs text-muted-foreground">
          Recommandé pour ce format : {range[0]} à {range[1]} chapitres. Actuellement : {list.length}.
        </p>
      )}
      {chapters.isPending && <Skeleton className="h-32 w-full" />}
      <ol className="flex flex-col gap-2">
        {list.map((chapter, index) => (
          <OutlineItem
            key={chapter.id}
            chapter={chapter}
            index={index}
            total={list.length}
            locked={locked}
            mutations={mutations}
            chapters={list}
          />
        ))}
      </ol>
      {!locked && (
        <form onSubmit={add} className="flex gap-2">
          <Input
            aria-label="Titre du nouveau chapitre"
            placeholder="Titre d'un nouveau chapitre"
            value={newTitle}
            maxLength={200}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!newTitle.trim() || mutations.add.isPending}>Ajouter</Button>
        </form>
      )}
      <Button size="lg" disabled={list.length === 0 || pending} onClick={() => advance({}, 6)}>
        Valider le plan
      </Button>
    </StepSection>
  );
}
