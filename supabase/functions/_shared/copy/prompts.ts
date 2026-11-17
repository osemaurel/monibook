import { LANGUAGE_NAMES, renderProjectBrief } from "../projects/context.ts";
import type { ProjectContext } from "../projects/types.ts";
import type { StructuredTextRequest } from "../services/text/index.ts";
import { COPY_ANGLES, COPY_TYPES, type CopyAngle, type CopyType } from "./config.ts";

const RULES = [
  "Vous êtes un rédacteur publicitaire expert du marketing de produits digitaux pour l'Afrique francophone.",
  "Vous écrivez des textes clairs, concrets et persuasifs, sans jargon, qui respectent le lecteur.",
  "Vous vous appuyez uniquement sur les informations du projet. Vous n'inventez ni chiffres, ni résultats, ni témoignages, ni récompenses : quand une information manque, vous laissez un emplacement entre crochets, par exemple [à compléter].",
  "Les prix s'écrivent en FCFA, sans décimale, avec une espace pour les milliers : 1 500 FCFA.",
  "Pas de promesse de gain garanti, pas de fausse urgence, pas de mention de marque ou de plateforme tierce.",
].join("\n");

export interface CopyPromptInput {
  project: ProjectContext;
  type: CopyType;
  angle: CopyAngle | null;
  /** Free mode: the approach of this variation. */
  approach?: string;
  /** Optional precision from the author (typed modes) or the request itself (free mode). */
  instructions?: string;
}

export function copyPrompt(input: CopyPromptInput): StructuredTextRequest {
  const definition = COPY_TYPES[input.type];
  const language = LANGUAGE_NAMES[input.project.language];
  const prompt = [
    "PROJET",
    renderProjectBrief(input.project),
    "",
    "DEMANDE",
    input.type === "free" ? `Demande de l'auteur : ${input.instructions ?? ""}` : definition.brief,
    input.angle
      ? `Angle : ${COPY_ANGLES[input.angle].label.toLowerCase()} — ${COPY_ANGLES[input.angle].direction}`
      : "",
    input.approach ? `Approche de cette version : ${input.approach}.` : "",
    input.type !== "free" && input.instructions ? `Précision de l'auteur : ${input.instructions}` : "",
    `Langue du texte : ${language}. Le lecteur est vouvoyé quand le texte est en français, sauf demande contraire de l'auteur.`,
  ].filter((line) => line !== "").join("\n");

  return {
    instructions: RULES,
    prompt,
    temperature: 0.9,
    maxOutputTokens: input.type === "sales_page" || input.type === "email_sequence" ? 6000 : 2500,
  };
}
