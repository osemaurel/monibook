import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ImagePlus, Plus, X } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useUserId } from "@/features/auth/auth-provider";
import { CreditCost } from "@/features/credits/credit-cost";
import { useCreditCheck } from "@/features/credits/use-credits";
import { useCreateJob } from "@/features/jobs/use-jobs";
import { ACCEPTED_COVER_TYPES, MAX_COVER_INPUT_BYTES } from "@/features/projects/cover";
import { benefitsError, benefitsToText, parseBenefits } from "@/features/projects/offer";
import type { Project } from "@/features/projects/project";
import { useCurrentProject } from "@/features/projects/project-context";
import { type ProjectFields, useUpdateProjectFields } from "@/features/projects/use-projects";
import { formatCredits, formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uploadVisualReference, useEbookTitle, useVisualBatches, type VisualBatchInput } from "./api";
import {
  BENEFITS_ON_VISUAL,
  HEADLINE_MAX_LENGTH,
  PROMISE_MAX_LENGTH,
  VARIATIONS_PER_BATCH,
  VISUAL_FORMATS,
  VISUAL_STYLES,
  type VisualFormat,
  VISUALS_JOB_KIND,
  type VisualStyle,
} from "./config";
import { VisualBatchCard } from "./visual-batch";

const digitsOnly = (value: string) => value.replace(/[\s  ]/g, "");

const FormSchema = z.object({
  format: z.enum(["square", "vertical"]),
  style: z.enum(["clean", "bold", "elegant", "warm", "modern"]),
  headline: z
    .string()
    .trim()
    .min(1, "Indiquez le titre affiché sur le visuel.")
    .max(HEADLINE_MAX_LENGTH, `${HEADLINE_MAX_LENGTH} caractères maximum.`),
  promise: z.string().trim().max(PROMISE_MAX_LENGTH, `${PROMISE_MAX_LENGTH} caractères maximum.`),
  price: z
    .string()
    .trim()
    .refine((v) => /^\d*$/.test(digitsOnly(v)), "Indiquez un montant entier en FCFA, sans décimale.")
    .refine((v) => Number(digitsOnly(v) || 0) <= 100_000_000, "Ce montant est trop élevé."),
  benefits: z.string().superRefine((value, ctx) => {
    const error = benefitsError(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  }),
  call_to_action: z
    .string()
    .trim()
    .min(1, "Indiquez le texte du bouton, par exemple « Je commande ».")
    .max(80, "80 caractères maximum."),
  guarantee: z.string().trim().max(200, "200 caractères maximum."),
});
type FormValues = z.infer<typeof FormSchema>;

function defaults(project: Project, ebookTitle: string | null): FormValues {
  return {
    format: "square",
    style: "bold",
    headline: (ebookTitle ?? project.name).slice(0, HEADLINE_MAX_LENGTH),
    promise: project.promise ?? "",
    price: project.planned_price_fcfa?.toString() ?? "",
    benefits: benefitsToText(project.benefits),
    call_to_action: project.call_to_action ?? "",
    guarantee: project.guarantee ?? "",
  };
}

/** What the project lacks and the form provides: saved so that it is never asked again. */
function missingProjectFields(project: Project, values: FormValues): Partial<ProjectFields> {
  const patch: Partial<ProjectFields> = {};
  const price = digitsOnly(values.price);
  const benefits = parseBenefits(values.benefits);
  if (!project.promise && values.promise) patch.promise = values.promise;
  if (project.planned_price_fcfa === null && price) patch.planned_price_fcfa = Number(price);
  if (project.benefits.length === 0 && benefits.length > 0) patch.benefits = benefits;
  if (!project.call_to_action && values.call_to_action) patch.call_to_action = values.call_to_action;
  if (!project.guarantee && values.guarantee) patch.guarantee = values.guarantee;
  return patch;
}

function toInput(values: FormValues, referencePath: string | undefined): VisualBatchInput {
  const price = digitsOnly(values.price);
  return {
    format: values.format,
    style: values.style,
    headline: values.headline,
    ...(values.promise ? { promise: values.promise } : {}),
    ...(price ? { price_fcfa: Number(price) } : {}),
    benefits: parseBenefits(values.benefits),
    call_to_action: values.call_to_action,
    ...(values.guarantee ? { guarantee: values.guarantee } : {}),
    ...(referencePath ? { reference_path: referencePath } : {}),
  };
}

function VisualsForm({ project, ebookTitle, onLaunched }: {
  project: Project;
  ebookTitle: string | null;
  onLaunched(): void;
}) {
  const userId = useUserId();
  const check = useCreditCheck(VISUALS_JOB_KIND);
  const createJob = useCreateJob();
  const updateProject = useUpdateProjectFields();
  const form = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: defaults(project, ebookTitle) });
  const { errors } = form.formState;
  const [reference, setReference] = useState<File | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!reference) return setPreviewUrl(undefined);
    const url = URL.createObjectURL(reference);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [reference]);

  function pickReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_COVER_TYPES.split(",").includes(file.type)) {
      return setReferenceError("Choisissez une image JPEG, PNG ou WebP.");
    }
    if (file.size > MAX_COVER_INPUT_BYTES) return setReferenceError("Cette image dépasse 15 Mo.");
    setReferenceError(null);
    setReference(file);
  }

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      let referencePath: string | undefined;
      if (reference) {
        try {
          referencePath = await uploadVisualReference(userId, project.id, reference);
        } catch {
          toast.error("L'image de référence n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.");
          return;
        }
      }
      const patch = missingProjectFields(project, values);
      if (Object.keys(patch).length > 0) {
        await updateProject.mutateAsync({ projectId: project.id, patch }).catch(() =>
          toast.warning("Les informations ajoutées n'ont pas pu être enregistrées dans le projet.")
        );
      }
      await createJob.mutateAsync({ kind: VISUALS_JOB_KIND, projectId: project.id, input: { ...toInput(values, referencePath) } });
      toast.success("Lot lancé. Vous pouvez fermer cette page : vos visuels seront enregistrés.");
      setReference(null);
      onLaunched();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Le lancement n'a pas abouti.");
    } finally {
      setPending(false);
    }
  });

  const format = form.watch("format");
  const style = form.watch("style");
  const price = digitsOnly(form.watch("price") ?? "");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Format</legend>
        <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2">
          {(Object.keys(VISUAL_FORMATS) as VisualFormat[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={format === value}
              onClick={() => form.setValue("format", value)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left",
                format === value && "border-foreground bg-muted/50",
              )}
            >
              <span
                aria-hidden
                className={cn("shrink-0 rounded-sm border-2 border-current", value === "square" ? "size-7" : "h-9 w-5")}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{VISUAL_FORMATS[value].label} · {VISUAL_FORMATS[value].ratio}</span>
                <span className="text-xs text-muted-foreground">{VISUAL_FORMATS[value].use}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Style</legend>
        <div role="radiogroup" aria-label="Style" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(VISUAL_STYLES) as VisualStyle[]).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={style === value}
              onClick={() => form.setValue("style", value)}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-3 text-left",
                style === value && "border-foreground bg-muted/50",
              )}
            >
              <span className="flex gap-1" aria-hidden>
                {VISUAL_STYLES[value].swatch.map((color) => (
                  <span key={color} className="size-4 rounded-full border" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span className="text-sm font-medium">{VISUAL_STYLES[value].label}</span>
              <span className="text-xs text-muted-foreground">{VISUAL_STYLES[value].description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Textes du visuel</p>
        <p className="text-xs text-muted-foreground">
          Pré-remplis depuis votre projet. Ce que vous ajoutez ici est aussi enregistré dans le projet ; les autres
          modifications ne valent que pour ce lot.
        </p>
      </div>
      <FieldGroup>
        <Field data-invalid={!!errors.headline}>
          <FieldLabel htmlFor="headline">Titre affiché</FieldLabel>
          <Input id="headline" aria-invalid={!!errors.headline} {...form.register("headline")} />
          <FieldError errors={[errors.headline]} />
        </Field>
        <Field data-invalid={!!errors.promise}>
          <FieldLabel htmlFor="promise">Promesse</FieldLabel>
          <Textarea id="promise" rows={2} {...form.register("promise")} />
          <FieldError errors={[errors.promise]} />
        </Field>
        <Field data-invalid={!!errors.price}>
          <FieldLabel htmlFor="price">Prix (FCFA)</FieldLabel>
          <Input id="price" inputMode="numeric" placeholder="Ex. : 5000" {...form.register("price")} />
          {!errors.price && /^\d+$/.test(price) && <FieldDescription>Affiché : {formatFcfa(Number(price))}</FieldDescription>}
          <FieldError errors={[errors.price]} />
        </Field>
        <Field data-invalid={!!errors.benefits}>
          <FieldLabel htmlFor="benefits">Bénéfices</FieldLabel>
          <Textarea id="benefits" rows={3} placeholder="Un bénéfice par ligne" {...form.register("benefits")} />
          <FieldDescription>Un par ligne. Les {BENEFITS_ON_VISUAL} premiers apparaissent sur le visuel « Bénéfices ».</FieldDescription>
          <FieldError errors={[errors.benefits]} />
        </Field>
        <Field data-invalid={!!errors.call_to_action}>
          <FieldLabel htmlFor="call_to_action">Appel à l'action</FieldLabel>
          <Input
            id="call_to_action"
            placeholder="Ex. : Je commande"
            aria-invalid={!!errors.call_to_action}
            {...form.register("call_to_action")}
          />
          <FieldError errors={[errors.call_to_action]} />
        </Field>
        <Field data-invalid={!!errors.guarantee}>
          <FieldLabel htmlFor="guarantee">Garantie</FieldLabel>
          <Input id="guarantee" placeholder="Ex. : Satisfait ou remboursé pendant 7 jours" {...form.register("guarantee")} />
          <FieldError errors={[errors.guarantee]} />
        </Field>

        <Field data-invalid={!!referenceError}>
          <FieldLabel>Référence visuelle (facultatif)</FieldLabel>
          <div className="flex items-center gap-3">
            {previewUrl && <img src={previewUrl} alt="Référence choisie" className="size-16 rounded-md border object-cover" />}
            <Button type="button" variant="outline" asChild>
              <label htmlFor="reference-input" className="cursor-pointer">
                <ImagePlus /> {reference ? "Changer l'image" : "Ajouter une image"}
              </label>
            </Button>
            {reference && (
              <Button type="button" variant="ghost" size="icon" aria-label="Retirer la référence" onClick={() => setReference(null)}>
                <X />
              </Button>
            )}
            <input id="reference-input" type="file" accept={ACCEPTED_COVER_TYPES} className="sr-only" onChange={pickReference} />
          </div>
          <FieldDescription>Un style, des couleurs ou une ambiance qui vous plaisent. Compressée avant l'envoi.</FieldDescription>
          {referenceError && <FieldError>{referenceError}</FieldError>}
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <CreditCost check={check} />
        <Button type="submit" size="lg" disabled={pending || !check.affordable}>
          {pending
            ? "Lancement…"
            : `Générer ${VARIATIONS_PER_BATCH} visuels${check.cost !== undefined ? ` · ${formatCredits(check.cost)}` : ""}`}
        </Button>
      </div>
    </form>
  );
}

export function VisualsPage() {
  const project = useCurrentProject();
  const ebookTitle = useEbookTitle(project.id);
  const batches = useVisualBatches(project.id);
  const [formOpen, setFormOpen] = useState<boolean | null>(null);
  const open = formOpen ?? batches.data?.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/projets/${project.id}?onglet=visuals`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {project.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Visuels publicitaires</h1>
        <p className="text-sm text-muted-foreground">
          Chaque lot donne {VARIATIONS_PER_BATCH} visuels aux concepts différents : produit en vedette, bénéfices,
          promesse et offre.
        </p>
      </div>

      {batches.isPending || ebookTitle.isPending
        ? <Skeleton className="h-64 w-full" />
        : open
        ? (
          <section className="flex flex-col gap-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">Nouveau lot</h2>
              {(batches.data?.length ?? 0) > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Fermer</Button>
              )}
            </div>
            <VisualsForm project={project} ebookTitle={ebookTitle.data ?? null} onLaunched={() => setFormOpen(false)} />
          </section>
        )
        : (
          <Button type="button" size="lg" onClick={() => setFormOpen(true)}>
            <Plus /> Créer un nouveau lot
          </Button>
        )}

      {(batches.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Vos lots</h2>
          {batches.data!.map((batch) => <VisualBatchCard key={batch.job.id} batch={batch} />)}
        </section>
      )}
      {batches.isError && (
        <p className="text-sm text-destructive">Vos visuels n'ont pas pu être chargés. Vérifiez votre connexion.</p>
      )}
    </div>
  );
}
