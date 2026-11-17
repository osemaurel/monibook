import { formatFcfa } from "../format.ts";
import { LANGUAGE_NAMES } from "../projects/context.ts";
import type { ProjectContext } from "../projects/types.ts";
import type { TEXT_ROLES } from "../services/image/index.ts";
import {
  VISUAL_CONCEPTS,
  VISUAL_FORMATS,
  VISUAL_STYLES,
  type VisualFormat,
  type VisualStyle,
} from "./config.ts";

/** What the visual says. Comes from the project, possibly adjusted for this batch. */
export interface VisualTexts {
  headline: string;
  promise?: string;
  priceFcfa?: number;
  benefits: string[];
  callToAction: string;
  guarantee?: string;
}

type TextItem = { role: (typeof TEXT_ROLES)[number]; text: string };

const MAX_BENEFITS_ON_VISUAL = 3;

/** Which texts each concept shows: fewer words, more impact. */
export function conceptTexts(
  concept: (typeof VISUAL_CONCEPTS)[number]["id"],
  texts: VisualTexts,
): TextItem[] {
  const price: TextItem[] = texts.priceFcfa !== undefined
    ? [{ role: "price", text: formatFcfa(texts.priceFcfa) }]
    : [];
  const guarantee: TextItem[] = texts.guarantee ? [{ role: "badge", text: texts.guarantee }] : [];
  const promise: TextItem[] = texts.promise ? [{ role: "subheadline", text: texts.promise }] : [];
  const benefits: TextItem[] = texts.benefits.slice(0, MAX_BENEFITS_ON_VISUAL).map((b) => ({
    role: "bullet",
    text: b,
  }));
  const headline: TextItem = { role: "headline", text: texts.headline };
  const cta: TextItem = { role: "cta", text: texts.callToAction };

  switch (concept) {
    case "product":
      return [headline, ...promise, ...price, cta];
    case "benefits":
      return [headline, ...(benefits.length > 0 ? benefits : promise), cta];
    case "promise":
      return texts.promise
        ? [{ role: "headline", text: texts.promise }, { role: "subheadline", text: texts.headline }, cta]
        : [headline, cta];
    case "offer":
      return [headline, ...price, ...guarantee, cta];
  }
}

const ROLE_LABELS: Record<TextItem["role"], string> = {
  headline: "Titre principal",
  subheadline: "Sous-titre",
  body: "Texte",
  bullet: "Point de liste",
  price: "Prix",
  cta: "Bouton d'appel à l'action",
  badge: "Badge",
};

export interface VisualPromptInput {
  project: ProjectContext;
  format: VisualFormat;
  style: VisualStyle;
  concept: (typeof VISUAL_CONCEPTS)[number];
  texts: TextItem[];
  hasStyleReference: boolean;
  hasProductImage: boolean;
}

/** Full brief of one visual: format, concept, style, audience, exact texts and production rules. */
export function visualPrompt(input: VisualPromptInput): string {
  const format = VISUAL_FORMATS[input.format];
  const style = VISUAL_STYLES[input.style];
  const { project } = input;
  const context = [
    project.niche && `Niche : ${project.niche}.`,
    project.audience && `Public visé : ${project.audience}.`,
    project.promise && `Promesse du produit : ${project.promise}.`,
  ].filter(Boolean).join(" ");

  return [
    `Créez un visuel publicitaire ${format.label} (${format.ratio}, ${format.width} × ${format.height} pixels) pour un produit digital, destiné aux ${format.use}.`,
    `Concept : ${input.concept.direction}.`,
    `Style : ${style.direction}.`,
    context,
    `Textes à afficher, exactement tels qu'écrits (orthographe, accents, espaces et majuscules compris), sans aucun autre texte :`,
    ...input.texts.map((t) => `- ${ROLE_LABELS[t.role]} : « ${t.text} »`),
    `Langue des textes : ${LANGUAGE_NAMES[project.language]}.`,
    input.hasProductImage
      ? "Représentez le produit avec l'image de couverture fournie, en maquette d'ebook réaliste, sans en modifier le contenu."
      : "",
    input.hasStyleReference
      ? "Inspirez-vous de l'image de référence fournie pour les couleurs, l'ambiance et la composition, sans la recopier."
      : "",
    "Règles : texte parfaitement lisible avec un fort contraste, hiérarchie claire, marges de sécurité de 8 % sur chaque bord, " +
    "aucun filigrane, aucun logo ni nom de marque tiers, aucune fausse interface, rendu net en haute résolution.",
  ].filter(Boolean).join("\n");
}
