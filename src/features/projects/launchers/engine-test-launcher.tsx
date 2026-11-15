import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCost } from "@/features/credits/credit-cost";
import { useCreditCheck } from "@/features/credits/use-credits";
import { useCreateJob } from "@/features/jobs/use-jobs";
import { formatCredits } from "@/lib/format";
import type { ProjectModule } from "../modules";
import { useCurrentProject } from "../project-context";

type SimulatedFailure = "none" | "first_attempt" | "always";

const OUTCOMES: Record<SimulatedFailure, string> = {
  none: "Réussite",
  first_attempt: "Échec à la 1re tentative, puis réussite",
  always: "Échec à chaque tentative (remboursement)",
};

export function EngineTestLauncher({ module }: { module: ProjectModule }) {
  const project = useCurrentProject();
  const check = useCreditCheck(module.jobKind);
  const createJob = useCreateJob();
  const [topic, setTopic] = useState(project.niche ?? project.name);
  const [outcome, setOutcome] = useState<SimulatedFailure>("none");

  const canLaunch = check.affordable && topic.trim().length > 0 && !createJob.isPending;

  function launch(event: FormEvent) {
    event.preventDefault();
    createJob.mutate(
      { kind: module.jobKind, projectId: project.id, input: { topic: topic.trim(), simulate_failure: outcome } },
      {
        onSuccess: () => toast.success("Génération lancée. Vous pouvez suivre sa progression ou fermer la page."),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <form onSubmit={launch} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="engine-test-topic">Sujet du test</FieldLabel>
          <Input
            id="engine-test-topic"
            value={topic}
            maxLength={200}
            onChange={(e) => setTopic(e.target.value)}
          />
          <FieldDescription>Pré-rempli avec la niche du projet.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="engine-test-outcome">Résultat simulé</FieldLabel>
          <Select value={outcome} onValueChange={(value) => setOutcome(value as SimulatedFailure)}>
            <SelectTrigger id="engine-test-outcome" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OUTCOMES).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <CreditCost check={check} />

      <Button type="submit" size="lg" disabled={!canLaunch}>
        {createJob.isPending
          ? "Lancement…"
          : `Lancer le test${check.cost !== undefined ? ` · ${formatCredits(check.cost)}` : ""}`}
      </Button>
    </form>
  );
}
