import type { Project } from "./project";

export interface LaunchRequirement {
  /** Phrase used in "Il manque : …". */
  label: string;
  met(project: Project): boolean;
}

const FIELD_REQUIREMENTS: LaunchRequirement[] = [
  { label: "la niche", met: (p) => !!p.niche },
  { label: "l'angle", met: (p) => !!p.angle },
  { label: "l'audience", met: (p) => !!p.audience },
  { label: "la promesse", met: (p) => !!p.promise },
  { label: "le prix envisagé", met: (p) => p.planned_price_fcfa !== null },
  { label: "la couverture", met: (p) => !!p.cover_path },
];

/** A deliverable counts only once a generation of its kind has actually succeeded. */
export function deliverableRequirement(label: string, jobKind: string): LaunchRequirement {
  return { label, met: (p) => (p.done_jobs_by_kind[jobKind] ?? 0) > 0 };
}

export function missingForLaunch(project: Project, deliverables: LaunchRequirement[]): string[] {
  return [...FIELD_REQUIREMENTS, ...deliverables].filter((r) => !r.met(project)).map((r) => r.label);
}

const listFormat = new Intl.ListFormat("fr", { type: "conjunction" });

/** ["la niche", "la couverture"] -> "Il manque la niche et la couverture." */
export function describeMissing(missing: string[]): string {
  if (missing.length === 0) return "Prêt à être lancé";
  return `Il manque ${listFormat.format(missing)}.`;
}
