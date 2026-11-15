import { zodResolver } from "@hookform/resolvers/zod";
import { type ChangeEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatFcfa } from "@/lib/format";
import { ACCEPTED_COVER_TYPES, MAX_COVER_INPUT_BYTES } from "./cover";
import { LANGUAGE_LABELS, PROJECT_STATUS_LABELS, type Project, type ProjectLanguage, type ProjectStatus } from "./project";
import { ProjectCover } from "./project-cover";
import { type CoverChange, type ProjectFields, type SaveProjectResult, useSaveProject } from "./use-projects";

const MAX_PRICE_FCFA = 100_000_000;
const digitsOnly = (value: string) => value.replace(/[\s  ]/g, "");
const optionalText = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`);

const FormSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à votre projet.").max(120, "120 caractères maximum."),
  niche: optionalText(200),
  angle: optionalText(500),
  audience: optionalText(500),
  promise: optionalText(300),
  price: z
    .string()
    .trim()
    .refine((v) => /^\d*$/.test(digitsOnly(v)), "Indiquez un montant entier en FCFA, sans décimale.")
    .refine((v) => Number(digitsOnly(v) || 0) <= MAX_PRICE_FCFA, "Ce montant est trop élevé."),
  language: z.enum(["fr", "en"]),
  status: z.enum(["draft", "in_progress", "launched", "archived"]),
});
type FormValues = z.infer<typeof FormSchema>;

function toFields(values: FormValues): ProjectFields {
  const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
  const price = digitsOnly(values.price);
  return {
    name: values.name.trim(),
    niche: orNull(values.niche),
    angle: orNull(values.angle),
    audience: orNull(values.audience),
    promise: orNull(values.promise),
    planned_price_fcfa: price === "" ? null : Number(price),
    language: values.language as ProjectLanguage,
    status: values.status as ProjectStatus,
  };
}

function defaults(project?: Project): FormValues {
  return {
    name: project?.name ?? "",
    niche: project?.niche ?? "",
    angle: project?.angle ?? "",
    audience: project?.audience ?? "",
    promise: project?.promise ?? "",
    price: project?.planned_price_fcfa?.toString() ?? "",
    language: project?.language ?? "fr",
    status: project?.status ?? "draft",
  };
}

export function ProjectForm({ project, submitLabel, onSaved }: {
  project?: Project;
  submitLabel: string;
  onSaved(result: SaveProjectResult): void;
}) {
  const save = useSaveProject();
  const form = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: defaults(project) });
  const { errors } = form.formState;

  const [cover, setCover] = useState<CoverChange>({ type: "keep" });
  const [coverError, setCoverError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (cover.type !== "replace") return setPreviewUrl(undefined);
    const url = URL.createObjectURL(cover.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function pickCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_COVER_TYPES.split(",").includes(file.type)) {
      return setCoverError("Choisissez une image JPEG, PNG ou WebP.");
    }
    if (file.size > MAX_COVER_INPUT_BYTES) return setCoverError("Cette image dépasse 15 Mo.");
    setCoverError(null);
    setCover({ type: "replace", file });
  }

  const submit = form.handleSubmit((values) =>
    save.mutate({ project, fields: toFields(values), cover }, { onSuccess: onSaved })
  );

  const price = digitsOnly(form.watch("price") ?? "");
  const hasCover = cover.type === "replace" || (cover.type === "keep" && !!project?.cover_path);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nom du projet</FieldLabel>
          <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.niche}>
          <FieldLabel htmlFor="niche">Niche</FieldLabel>
          <Input id="niche" placeholder="Ex. : cuisine rapide pour étudiants" {...form.register("niche")} />
          <FieldError errors={[errors.niche]} />
        </Field>

        <Field data-invalid={!!errors.angle}>
          <FieldLabel htmlFor="angle">Angle</FieldLabel>
          <Textarea id="angle" rows={2} placeholder="Ce qui rend votre produit différent" {...form.register("angle")} />
          <FieldError errors={[errors.angle]} />
        </Field>

        <Field data-invalid={!!errors.audience}>
          <FieldLabel htmlFor="audience">Audience</FieldLabel>
          <Textarea id="audience" rows={2} placeholder="À qui s'adresse ce produit" {...form.register("audience")} />
          <FieldError errors={[errors.audience]} />
        </Field>

        <Field data-invalid={!!errors.promise}>
          <FieldLabel htmlFor="promise">Promesse</FieldLabel>
          <Textarea id="promise" rows={2} placeholder="Le résultat que l'acheteur obtiendra" {...form.register("promise")} />
          <FieldError errors={[errors.promise]} />
        </Field>

        <Field data-invalid={!!errors.price}>
          <FieldLabel htmlFor="price">Prix envisagé (FCFA)</FieldLabel>
          <Input id="price" inputMode="numeric" placeholder="Ex. : 5000" {...form.register("price")} />
          {!errors.price && /^\d+$/.test(price) && <FieldDescription>Soit {formatFcfa(Number(price))}</FieldDescription>}
          <FieldError errors={[errors.price]} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="language">Langue</FieldLabel>
            <Controller
              control={form.control}
              name="language"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="language" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="status">Statut</FieldLabel>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field data-invalid={!!coverError}>
          <FieldLabel>Couverture</FieldLabel>
          <div className="flex items-end gap-3">
            <ProjectCover
              path={cover.type === "remove" ? null : project?.cover_path ?? null}
              previewUrl={previewUrl}
              className="w-24 shrink-0"
            />
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" asChild>
                <label htmlFor="cover-input" className="cursor-pointer">
                  {hasCover ? "Changer l'image" : "Choisir une image"}
                </label>
              </Button>
              {hasCover && (
                <Button type="button" variant="ghost" onClick={() => setCover({ type: "remove" })}>
                  Retirer
                </Button>
              )}
            </div>
            <input id="cover-input" type="file" accept={ACCEPTED_COVER_TYPES} className="sr-only" onChange={pickCover} />
          </div>
          <FieldDescription>JPEG, PNG ou WebP. L'image est compressée avant l'envoi.</FieldDescription>
          {coverError && <FieldError>{coverError}</FieldError>}
        </Field>
      </FieldGroup>

      {save.isError && (
        <p className="text-sm text-destructive">Le projet n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.</p>
      )}

      <Button type="submit" size="lg" disabled={save.isPending}>
        {save.isPending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}
