import { ArrowDown, ArrowUp, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentProject } from "@/features/projects/project-context";
import { formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type Chapter, ebookErrorMessage, useChapterMutations, useChapters } from "../api";
import { GenerateAction, StepSection } from "../components";
import { markupToHtml } from "../markup";
import { type EbookStepProps, useAdvance } from "./shared";

function EditorChapter({ ebookId, chapter, index, chapters, mutations, open, onToggle }: {
  ebookId: string;
  chapter: Chapter;
  index: number;
  chapters: Chapter[];
  mutations: ReturnType<typeof useChapterMutations>;
  open: boolean;
  onToggle(): void;
}) {
  const project = useCurrentProject();
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content ?? "");
  const [preview, setPreview] = useState(false);
  const [instructions, setInstructions] = useState("");
  const rewriting = chapter.status === "writing";
  const dirty = title.trim() !== chapter.title || content !== (chapter.content ?? "");

  // A regenerated chapter replaces what is shown.
  useEffect(() => {
    setTitle(chapter.title);
    setContent(chapter.content ?? "");
  }, [chapter.title, chapter.content]);

  function save() {
    mutations.update.mutate(
      { id: chapter.id, patch: { title: title.trim() || chapter.title, content } },
      {
        onSuccess: () => toast.success("Chapitre enregistré."),
        onError: (e) => toast.error(ebookErrorMessage(e)),
      },
    );
  }

  return (
    <li className="rounded-lg border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{chapter.title}</span>
          <span className="text-xs text-muted-foreground">
            {rewriting
              ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Rédaction en cours
                </span>
              )
              : chapter.word_count > 0
              ? `${formatInteger(chapter.word_count)} mots`
              : "Pas encore de texte"}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t p-3">
          <Field>
            <FieldLabel htmlFor={`title-${chapter.id}`}>Titre du chapitre</FieldLabel>
            <Input id={`title-${chapter.id}`} value={title} maxLength={200} disabled={rewriting} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex gap-1" role="tablist" aria-label="Affichage du texte">
              <Button type="button" size="sm" variant={preview ? "ghost" : "secondary"} role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>
                Texte
              </Button>
              <Button type="button" size="sm" variant={preview ? "secondary" : "ghost"} role="tab" aria-selected={preview} onClick={() => setPreview(true)}>
                Aperçu
              </Button>
            </div>
            {preview
              ? <div className="ebook-prose rounded-md border p-3" dangerouslySetInnerHTML={{ __html: markupToHtml(content) }} />
              : (
                <Textarea
                  aria-label={`Texte du chapitre ${index + 1}`}
                  rows={14}
                  maxLength={100000}
                  value={content}
                  disabled={rewriting}
                  onChange={(e) => setContent(e.target.value)}
                />
              )}
            <p className="text-xs text-muted-foreground">
              Mise en forme : « ## » pour un intertitre, « - » pour une liste, « &gt; » pour une citation,
              « :::encadre Titre » … « ::: » pour un encadré, **gras**, *italique*.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" disabled={!dirty || rewriting || mutations.update.isPending} onClick={save}>Enregistrer</Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                setTitle(chapter.title);
                setContent(chapter.content ?? "");
              }}
            >
              Annuler
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            <Field>
              <FieldLabel htmlFor={`instructions-${chapter.id}`}>
                {chapter.content ? "Regénérer ce chapitre" : "Rédiger ce chapitre"}
              </FieldLabel>
              <Input
                id={`instructions-${chapter.id}`}
                value={instructions}
                maxLength={1000}
                placeholder="Consigne facultative, ex. : ajouter un exemple chiffré"
                onChange={(e) => setInstructions(e.target.value)}
              />
            </Field>
            <GenerateAction
              kind="ebook_chapter_rewrite"
              ebookId={ebookId}
              projectId={project.id}
              chapterId={chapter.id}
              input={{ ebook_id: ebookId, chapter_id: chapter.id, ...(instructions.trim() ? { instructions: instructions.trim() } : {}) }}
              label={chapter.content ? "Regénérer ce chapitre" : "Rédiger ce chapitre"}
              hint={chapter.content ? "Seul ce chapitre est réécrit ; le texte actuel est remplacé." : undefined}
              disabled={dirty}
            />
          </div>

          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Monter" disabled={index === 0} onClick={() => mutations.move(chapters, index, -1)}>
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Descendre"
              disabled={index === chapters.length - 1}
              onClick={() => mutations.move(chapters, index, 1)}
            >
              <ArrowDown />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Supprimer ce chapitre" disabled={rewriting}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer « {chapter.title} » ?</AlertDialogTitle>
                  <AlertDialogDescription>Le texte de ce chapitre sera définitivement supprimé.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => mutations.remove.mutate(chapter.id)}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </li>
  );
}

export function EditorStep({ ebook, goTo }: EbookStepProps) {
  const chapters = useChapters(ebook.id);
  const mutations = useChapterMutations(ebook.id);
  const { advance, pending } = useAdvance(ebook, goTo);
  const [open, setOpen] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const list = chapters.data ?? [];

  function add(event: FormEvent) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    mutations.add.mutate({ title: newTitle.trim() }, {
      onSuccess: (chapter) => {
        setNewTitle("");
        setOpen(chapter.id);
      },
      onError: (e) => toast.error(ebookErrorMessage(e)),
    });
  }

  return (
    <StepSection
      title="Éditeur"
      description="Corrigez le texte à la main, regénérez un seul chapitre, réordonnez, ajoutez ou supprimez des chapitres."
    >
      {chapters.isPending && <Skeleton className="h-40 w-full" />}
      <ol className="flex flex-col gap-2">
        {list.map((chapter, index) => (
          <EditorChapter
            key={chapter.id}
            ebookId={ebook.id}
            chapter={chapter}
            index={index}
            chapters={list}
            mutations={mutations}
            open={open === chapter.id}
            onToggle={() => setOpen(open === chapter.id ? null : chapter.id)}
          />
        ))}
      </ol>
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
      <Button size="lg" disabled={pending || list.length === 0} onClick={() => (ebook.step >= 9 ? goTo(9) : advance({}, 9))}>
        Passer à l'export
      </Button>
    </StepSection>
  );
}
