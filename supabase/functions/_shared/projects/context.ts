import { formatFcfa } from "../format.ts";
import { JobError } from "../jobs/errors.ts";
import type { JobContext } from "../jobs/types.ts";
import type { ProjectContext } from "./types.ts";

/** The project must belong to the job's user; anything else is refused and refunded. */
export async function loadOwnedProject(ctx: JobContext): Promise<ProjectContext> {
  const project = await ctx.data.projects.getContext(ctx.projectId);
  if (!project || project.userId !== ctx.userId) {
    throw new JobError("invalid_input", false, "project not found for this user");
  }
  return project;
}

export const LANGUAGE_NAMES = { fr: "français", en: "anglais" } as const;

/** French brief of the project, injected into every copy and visual prompt. Missing fields are left out. */
export function renderProjectBrief(project: ProjectContext): string {
  const lines: string[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) lines.push(`${label} : ${value.trim()}`);
  };
  const product = project.product;
  if (product) {
    add("Produit", `ebook « ${product.title} »${product.subtitle ? ` — ${product.subtitle}` : ""}`);
    add("Auteur", product.author);
    if (product.chapterTitles.length > 0) add("Nombre de chapitres", String(product.chapterTitles.length));
  } else {
    add("Produit", project.name);
  }
  add("Niche", project.niche);
  add("Angle marketing du projet", project.angle);
  add("Public visé", project.audience);
  add("Promesse", project.promise);
  if (project.priceFcfa !== null) add("Prix", formatFcfa(project.priceFcfa));
  if (project.benefits.length > 0) {
    lines.push("Bénéfices :", ...project.benefits.map((b) => `- ${b}`));
  }
  add("Garantie", project.guarantee);
  add("Appel à l'action", project.callToAction);
  if (product?.summary) add("Résumé du produit", product.summary);
  if (product && product.chapterTitles.length > 0) {
    lines.push("Sommaire :", ...product.chapterTitles.map((t, i) => `${i + 1}. ${t}`));
  }
  return lines.join("\n");
}

/** Title of the product as shown to buyers: the ebook title when there is one, else the project name. */
export function productTitle(project: ProjectContext): string {
  return project.product?.title ?? project.name;
}
