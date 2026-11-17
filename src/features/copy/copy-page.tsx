import { ArrowLeft, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CreditCost } from "@/features/credits/credit-cost";
import { useCreditCheck, useCreditCosts } from "@/features/credits/use-credits";
import { JobProgress } from "@/features/jobs/job-progress";
import { isActive, type JobView } from "@/features/jobs/jobs-cache";
import { LiveJobProgress } from "@/features/jobs/live-job";
import { useCreateJob } from "@/features/jobs/use-jobs";
import type { Project } from "@/features/projects/project";
import { useCurrentProject } from "@/features/projects/project-context";
import { formatCredits, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type CopyText, useCopyJobs, useCopyTextMutations, useCopyTexts } from "./api";
import {
  COPY_ANGLES,
  COPY_TYPES,
  type CopyType,
  copyType,
  type CopyTypeDefinition,
  type CopyVariation,
  FREE_REQUEST_MAX_LENGTH,
  FREE_REQUEST_MIN_LENGTH,
  FREE_TYPE,
  hasPlaceholders,
  INSTRUCTIONS_MAX_LENGTH,
  jobVariations,
  TITLE_MAX_LENGTH,
  VARIATIONS_BY_TYPE,
} from "./config";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Texte copié.");
  } catch {
    toast.error("La copie n'a pas fonctionné. Sélectionnez le texte et copiez-le à la main.");
  }
}

function PlaceholderHint({ text }: { text: string }) {
  if (!hasPlaceholders(text)) return null;
  return (
    <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Remplacez les passages entre crochets [ ] par vos vraies informations avant de publier.
    </p>
  );
}

/** Long texts are folded to keep the screen light on a phone. */
function TextPreview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 600;
  return (
    <div className="flex flex-col gap-1">
      <p className={cn("text-sm whitespace-pre-wrap", long && !expanded && "line-clamp-[12]")}>{text}</p>
      {long && (
        <button type="button" className="self-start text-xs underline underline-offset-4" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Réduire" : "Afficher tout le texte"}
        </button>
      )}
    </div>
  );
}

function TextEditor({ initialTitle, initialContent, saveLabel, pending, onSave, onCancel }: {
  initialTitle: string;
  initialContent: string;
  saveLabel: string;
  pending: boolean;
  onSave(title: string, content: string): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState(initialTitle.slice(0, TITLE_MAX_LENGTH));
  const [content, setContent] = useState(initialContent);
  const valid = title.trim() !== "" && content.trim() !== "";
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="copy-title">Nom du texte</FieldLabel>
        <Input id="copy-title" value={title} maxLength={TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="copy-content">Texte</FieldLabel>
        <Textarea id="copy-content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <PlaceholderHint text={content} />
      <div className="flex gap-2">
        <Button type="button" disabled={!valid || pending} onClick={() => onSave(title, content)}>
          {pending ? "Enregistrement…" : saveLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

function VariationCard({ variation, index, type, jobId, projectId }: {
  variation: CopyVariation;
  index: number;
  type: CopyTypeDefinition;
  jobId: string;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const { save } = useCopyTextMutations(projectId);

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{variation.angle ? COPY_ANGLES[variation.angle] : `Version ${index + 1}`}</Badge>
        {type.id === "free" && <span className="text-sm font-medium">{variation.title}</span>}
      </div>
      {editing
        ? (
          <TextEditor
            initialTitle={variation.title}
            initialContent={variation.content}
            saveLabel="Enregistrer dans mes textes"
            pending={save.isPending}
            onCancel={() => setEditing(false)}
            onSave={(title, content) =>
              save.mutate(
                { jobId, type: type.id, angle: variation.angle, title, content },
                {
                  onSuccess: () => {
                    toast.success("Texte enregistré.");
                    setEditing(false);
                  },
                  onError: () => toast.error("Le texte n'a pas pu être enregistré. Réessayez."),
                },
              )}
          />
        )
        : (
          <>
            <TextPreview text={variation.content} />
            <PlaceholderHint text={variation.content} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Choisir et modifier
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard(variation.content)}>
                <Copy /> Copier
              </Button>
            </div>
          </>
        )}
    </article>
  );
}

function SavedTextCard({ text, projectId }: { text: CopyText; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const { update, remove } = useCopyTextMutations(projectId);

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium">{text.title}</p>
        <p className="text-xs text-muted-foreground">Modifié le {formatDateTime(text.updated_at)}</p>
      </div>
      {editing
        ? (
          <TextEditor
            initialTitle={text.title}
            initialContent={text.content}
            saveLabel="Enregistrer"
            pending={update.isPending}
            onCancel={() => setEditing(false)}
            onSave={(title, content) =>
              update.mutate({ id: text.id, title, content }, {
                onSuccess: () => {
                  toast.success("Modifications enregistrées.");
                  setEditing(false);
                },
                onError: () => toast.error("Les modifications n'ont pas pu être enregistrées. Réessayez."),
              })}
          />
        )
        : (
          <>
            <TextPreview text={text.content} />
            <PlaceholderHint text={text.content} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard(text.content)}>
                <Copy /> Copier
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" aria-label={`Supprimer « ${text.title} »`}>
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer « {text.title} » ?</AlertDialogTitle>
                    <AlertDialogDescription>Ce texte enregistré sera définitivement supprimé.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        remove.mutate(text.id, { onError: () => toast.error("Le texte n'a pas pu être supprimé.") })}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
    </article>
  );
}

function GenerateCopy({ type, project }: { type: CopyTypeDefinition; project: Project }) {
  const check = useCreditCheck(type.kind);
  const createJob = useCreateJob();
  const [text, setText] = useState("");
  const free = type.id === "free";
  const trimmed = text.trim();
  const valid = free ? trimmed.length >= FREE_REQUEST_MIN_LENGTH : true;
  const count = VARIATIONS_BY_TYPE(type.id);

  function launch() {
    const input = free ? { request: trimmed } : trimmed ? { instructions: trimmed } : {};
    createJob.mutate({ kind: type.kind, projectId: project.id, input }, {
      onSuccess: () => {
        setText("");
        toast.success("Rédaction lancée. Vous pouvez fermer cette page : les textes seront enregistrés.");
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <Field>
        <FieldLabel htmlFor="copy-request">{free ? "Votre demande" : "Précision (facultatif)"}</FieldLabel>
        <Textarea
          id="copy-request"
          rows={free ? 4 : 2}
          maxLength={free ? FREE_REQUEST_MAX_LENGTH : INSTRUCTIONS_MAX_LENGTH}
          placeholder={free
            ? "Ex. : un message WhatsApp pour relancer les clients qui ont demandé le prix sans acheter"
            : "Ex. : insistez sur le prix de lancement"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <FieldDescription>
          {free
            ? "Tout le contexte du projet est déjà pris en compte : décrivez seulement le texte voulu."
            : "Tout part de votre projet : promesse, public, prix, offre et contenu de l'ebook."}
        </FieldDescription>
      </Field>
      <CreditCost check={check} />
      <Button type="button" size="lg" onClick={launch} disabled={!valid || !check.affordable || createJob.isPending}>
        {createJob.isPending
          ? "Lancement…"
          : `Écrire ${count} variations${check.cost !== undefined ? ` · ${formatCredits(check.cost)}` : ""}`}
      </Button>
    </div>
  );
}

function Generations({ type, project }: { type: CopyTypeDefinition; project: Project }) {
  const jobs = useCopyJobs(project.id, type.kind);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (jobs.isPending) return <Skeleton className="h-40 w-full" />;

  const list = jobs.data ?? [];
  const active = list.filter(isActive);
  const done = list.filter((j) => j.status === "done");
  const latest = list[0];
  const shown: JobView | undefined = done.find((j) => j.id === selectedId) ?? done[0];
  const variations = shown ? jobVariations(shown.output) : [];

  return (
    <div className="flex flex-col gap-3">
      {active.map((job) => <LiveJobProgress key={job.id} job={job} />)}
      {latest?.status === "failed" && <JobProgress job={latest} />}
      {shown && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Variations proposées</h2>
            <p className="text-xs text-muted-foreground">
              Générées le {formatDateTime(shown.finished_at ?? shown.created_at)}. Choisissez-en une, modifiez-la, puis
              enregistrez-la dans vos textes.
            </p>
            {done.length > 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label="Génération affichée">
                {done.map((job, i) => (
                  <button
                    key={job.id}
                    type="button"
                    role="radio"
                    aria-checked={job.id === shown.id}
                    onClick={() => setSelectedId(job.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      job.id === shown.id && "border-foreground bg-foreground text-background",
                    )}
                  >
                    {i === 0 ? "Dernière" : formatDateTime(job.finished_at ?? job.created_at)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {variations.map((variation, index) => (
            <VariationCard
              key={`${shown.id}-${index}`}
              variation={variation}
              index={index}
              type={type}
              jobId={shown.id}
              projectId={project.id}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function TypeView({ type, project }: { type: CopyTypeDefinition; project: Project }) {
  const texts = useCopyTexts(project.id);
  const saved = (texts.data ?? []).filter((t) => t.type === type.id);
  return (
    <div className="flex flex-col gap-5">
      <Link to="?" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Tous les types de textes
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{type.label}</h1>
        <p className="text-sm text-muted-foreground">
          {type.description}
          {type.id !== "free" && " Quatre variations, une par angle : émotionnel, chiffré, témoignage, urgence."}
        </p>
      </div>
      <GenerateCopy type={type} project={project} />
      <Generations type={type} project={project} />
      {saved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Vos textes enregistrés</h2>
          {saved.map((text) => <SavedTextCard key={text.id} text={text} projectId={project.id} />)}
        </section>
      )}
    </div>
  );
}

function MissingContextHint({ project }: { project: Project }) {
  const missing = [
    !project.promise && "la promesse",
    !project.audience && "le public visé",
    project.planned_price_fcfa === null && "le prix",
    project.benefits.length === 0 && "les bénéfices",
  ].filter(Boolean) as string[];
  if (missing.length === 0) return null;
  const list = new Intl.ListFormat("fr", { type: "conjunction" }).format(missing);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
      <p>Pour des textes plus justes, complétez {list} dans votre projet : tous les textes en dépendent.</p>
      <Button size="sm" variant="outline" className="self-start" asChild>
        <Link to={`/projets/${project.id}/modifier`}>Compléter le projet</Link>
      </Button>
    </div>
  );
}

function TypePicker({ project }: { project: Project }) {
  const costs = useCreditCosts();
  const texts = useCopyTexts(project.id);
  const savedCount = (type: CopyType) => (texts.data ?? []).filter((t) => t.type === type).length;
  const priced = (definition: CopyTypeDefinition) => costs.data?.[definition.kind] !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/projets/${project.id}?onglet=texts`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {project.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Textes de vente</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez un type de texte. Chacun est écrit à partir de votre projet, en plusieurs variations aux angles
          différents.
        </p>
      </div>
      <MissingContextHint project={project} />
      {costs.isPending
        ? <Skeleton className="h-64 w-full" />
        : (
          <nav aria-label="Types de textes" className="flex flex-col gap-2">
            {COPY_TYPES.filter(priced).map((definition) => (
              <TypeLink key={definition.id} definition={definition} cost={costs.data![definition.kind]} saved={savedCount(definition.id)} />
            ))}
          </nav>
        )}
      {costs.data && priced(FREE_TYPE) && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">Besoin d'un autre texte ?</p>
          <TypeLink definition={FREE_TYPE} cost={costs.data[FREE_TYPE.kind]} saved={savedCount("free")} subtle />
        </div>
      )}
    </div>
  );
}

function TypeLink({ definition, cost, saved, subtle }: {
  definition: CopyTypeDefinition;
  cost: number;
  saved: number;
  subtle?: boolean;
}) {
  return (
    <Link
      to={`?type=${definition.id}`}
      className={cn("flex items-center gap-3 rounded-lg border p-3", subtle && "border-dashed")}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{definition.label}</span>
        <span className="text-xs text-muted-foreground">{definition.description}</span>
        <span className="text-xs text-muted-foreground">
          {formatCredits(cost)}
          {saved > 0 && ` · ${saved} ${saved > 1 ? "textes enregistrés" : "texte enregistré"}`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export function CopyPage() {
  const project = useCurrentProject();
  const [params] = useSearchParams();
  const type = copyType(params.get("type"));
  return type ? <TypeView key={type.id} type={type} project={project} /> : <TypePicker project={project} />;
}
