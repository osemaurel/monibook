import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/features/auth/use-profile";
import { useCreditCosts } from "@/features/credits/use-credits";
import { useCurrentProject } from "@/features/projects/project-context";
import type { Project } from "@/features/projects/project";
import { formatCredits } from "@/lib/format";
import { GenerateAction, LockedNotice, StepSection } from "../components";
import { type EbookLength, type EbookTemplate, LENGTHS, TEMPLATES, TONES } from "../config";
import { type EbookStepProps, type StepProps, useAdvance } from "./shared";

function ChoiceCard({ name, value, checked, disabled, onChange, title, description }: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange(value: string): void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[:checked]:border-foreground has-[:checked]:bg-muted/50 has-[:disabled]:cursor-default">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 accent-foreground"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function defaultSubject(project: Project): string {
  return [project.niche, project.promise].filter(Boolean).join(" — ") || project.name;
}

export function SubjectStep({ ebook, goTo }: StepProps) {
  const project = useCurrentProject();
  const locked = !!ebook?.bible;
  const [subject, setSubject] = useState(ebook?.subject ?? defaultSubject(project));
  const [template, setTemplate] = useState<EbookTemplate | null>(ebook?.template ?? null);
  const { advance, pending } = useAdvance(ebook, goTo);

  return (
    <StepSection title="Sujet et gabarit" description="Le gabarit détermine la forme du plan qui vous sera proposé.">
      {locked && <LockedNotice />}
      <Field>
        <FieldLabel htmlFor="ebook-subject">Sujet du livre</FieldLabel>
        <Textarea
          id="ebook-subject"
          rows={3}
          maxLength={1000}
          value={subject}
          disabled={locked}
          onChange={(e) => setSubject(e.target.value)}
        />
        <FieldDescription>Pré-rempli avec la niche et la promesse du projet.</FieldDescription>
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Gabarit de structure</FieldLegend>
        <div className="flex flex-col gap-2">
          {Object.entries(TEMPLATES).map(([value, t]) => (
            <ChoiceCard
              key={value}
              name="ebook-template"
              value={value}
              checked={template === value}
              disabled={locked}
              onChange={(v) => setTemplate(v as EbookTemplate)}
              title={t.label}
              description={t.description}
            />
          ))}
        </div>
      </FieldSet>
      <Button
        size="lg"
        disabled={locked || !subject.trim() || !template || pending}
        onClick={() => advance({ subject: subject.trim(), template }, 2)}
      >
        Valider et continuer
      </Button>
    </StepSection>
  );
}

const CUSTOM = "__custom__";

export function TitleStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const proposals = Array.isArray(ebook.title_proposals) ? (ebook.title_proposals as string[]) : [];
  const initialIsProposal = !!ebook.title && proposals.includes(ebook.title);
  const [choice, setChoice] = useState(ebook.title ? (initialIsProposal ? ebook.title : CUSTOM) : "");
  const [custom, setCustom] = useState(ebook.title && !initialIsProposal ? ebook.title : "");
  const [subtitle, setSubtitle] = useState(ebook.subtitle ?? "");
  const { advance, pending } = useAdvance(ebook, goTo);
  const title = (choice === CUSTOM ? custom : choice).trim();

  return (
    <StepSection title="Titre" description="Choisissez l'une des propositions ou écrivez votre propre titre.">
      <GenerateAction
        kind="ebook_titles"
        ebookId={ebook.id}
        projectId={project.id}
        input={{ ebook_id: ebook.id }}
        label={proposals.length > 0 ? "Proposer 5 autres titres" : "Proposer 5 titres"}
      />
      <FieldSet>
        <FieldLegend variant="label">Titre retenu</FieldLegend>
        <div className="flex flex-col gap-2">
          {proposals.map((proposal) => (
            <label key={proposal} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-foreground">
              <input
                type="radio"
                name="ebook-title"
                checked={choice === proposal}
                onChange={() => setChoice(proposal)}
                className="mt-1 accent-foreground"
              />
              <span className="text-sm">{proposal}</span>
            </label>
          ))}
          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border p-3 has-[:checked]:border-foreground">
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="ebook-title"
                checked={choice === CUSTOM}
                onChange={() => setChoice(CUSTOM)}
                className="accent-foreground"
              />
              <span className="text-sm">Écrire mon propre titre</span>
            </span>
            <Input
              aria-label="Votre titre"
              value={custom}
              maxLength={200}
              placeholder="Votre titre"
              onFocus={() => setChoice(CUSTOM)}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        </div>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor="ebook-subtitle">Sous-titre (facultatif)</FieldLabel>
        <Input id="ebook-subtitle" value={subtitle} maxLength={300} onChange={(e) => setSubtitle(e.target.value)} />
      </Field>
      <Button
        size="lg"
        disabled={!title || pending}
        onClick={() => advance({ title, subtitle: subtitle.trim() || null }, 3)}
      >
        Valider ce titre
      </Button>
    </StepSection>
  );
}

export function SummaryStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const locked = !!ebook.bible;
  const [text, setText] = useState(ebook.summary ?? "");
  const { advance, pending } = useAdvance(ebook, goTo);

  // A new proposal from the server replaces the text being edited.
  useEffect(() => setText(ebook.summary ?? ""), [ebook.summary]);

  return (
    <StepSection title="Résumé" description="Le résumé présente le livre. Modifiez-le librement avant de le valider.">
      {locked ? <LockedNotice /> : (
        <GenerateAction
          kind="ebook_summary"
          ebookId={ebook.id}
          projectId={project.id}
          input={{ ebook_id: ebook.id }}
          label={ebook.summary ? "Proposer un autre résumé" : "Proposer un résumé"}
          hint={ebook.summary ? "Une nouvelle proposition remplace le texte ci-dessous." : undefined}
        />
      )}
      <Field>
        <FieldLabel htmlFor="ebook-summary">Résumé</FieldLabel>
        <Textarea
          id="ebook-summary"
          rows={9}
          maxLength={5000}
          value={text}
          readOnly={locked}
          onChange={(e) => setText(e.target.value)}
        />
        <FieldDescription>{text.length} / 5 000 caractères</FieldDescription>
      </Field>
      <Button size="lg" disabled={locked || !text.trim() || pending} onClick={() => advance({ summary: text.trim() }, 4)}>
        Valider le résumé
      </Button>
    </StepSection>
  );
}

const OTHER_TONE = "__other__";

export function FramingStep({ ebook, goTo }: EbookStepProps) {
  const profile = useProfile();
  const costs = useCreditCosts();
  const locked = !!ebook.bible;
  const [length, setLength] = useState<EbookLength | null>(ebook.length);
  const knownTone = !!ebook.tone && TONES.includes(ebook.tone);
  const [tone, setTone] = useState(ebook.tone ? (knownTone ? ebook.tone : OTHER_TONE) : TONES[0]);
  const [customTone, setCustomTone] = useState(ebook.tone && !knownTone ? ebook.tone : "");
  const [instructions, setInstructions] = useState(ebook.instructions ?? "");
  const [author, setAuthor] = useState(ebook.author_name ?? "");
  const { advance, pending } = useAdvance(ebook, goTo);

  useEffect(() => {
    if (!author && profile.data?.display_name) setAuthor(profile.data.display_name);
  }, [profile.data?.display_name, author]);

  const finalTone = (tone === OTHER_TONE ? customTone : tone).trim();

  return (
    <StepSection title="Cadrage" description="Longueur, ton et consignes guideront le plan puis la rédaction.">
      {locked && <LockedNotice />}
      <FieldSet>
        <FieldLegend variant="label">Longueur</FieldLegend>
        <div className="flex flex-col gap-2">
          {Object.entries(LENGTHS).map(([value, l]) => {
            const cost = costs.data?.[l.writeKind];
            return (
              <ChoiceCard
                key={value}
                name="ebook-length"
                value={value}
                checked={length === value}
                disabled={locked}
                onChange={(v) => setLength(v as EbookLength)}
                title={`${l.label} · ${l.pages}`}
                description={`${l.chapters[0]} à ${l.chapters[1]} chapitres${
                  cost !== undefined ? ` · rédaction : ${formatCredits(cost)}` : ""
                }`}
              />
            );
          })}
        </div>
      </FieldSet>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ebook-tone">Ton</FieldLabel>
          <Select value={tone} onValueChange={setTone} disabled={locked}>
            <SelectTrigger id="ebook-tone" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              <SelectItem value={OTHER_TONE}>Autre ton…</SelectItem>
            </SelectContent>
          </Select>
          {tone === OTHER_TONE && (
            <Input
              aria-label="Ton souhaité"
              value={customTone}
              maxLength={200}
              disabled={locked}
              placeholder="Décrivez le ton souhaité"
              onChange={(e) => setCustomTone(e.target.value)}
            />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="ebook-instructions">Consignes personnalisées (facultatif)</FieldLabel>
          <Textarea
            id="ebook-instructions"
            rows={4}
            maxLength={3000}
            disabled={locked}
            value={instructions}
            placeholder="Ex. : tutoyer le lecteur, citer des exemples d'Afrique de l'Ouest, éviter le jargon…"
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ebook-author">Nom de l'auteur</FieldLabel>
          <Input id="ebook-author" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
      </FieldGroup>
      <Button
        size="lg"
        disabled={!length || !finalTone || !author.trim() || pending}
        onClick={() =>
          advance(
            locked
              ? { author_name: author.trim() }
              : { length, tone: finalTone, instructions: instructions.trim() || null, author_name: author.trim() },
            5,
          )}
      >
        Valider le cadrage
      </Button>
    </StepSection>
  );
}
