export type EbookTemplate = "method_guide" | "step_by_step" | "recipes" | "business_money" | "free";
export type EbookLength = "short" | "standard" | "complete";

/** Shape of the outline each template asks for. */
export const TEMPLATE_STRUCTURES: Record<EbookTemplate, { label: string; structure: string }> = {
  method_guide: {
    label: "Guide méthode",
    structure:
      "Pose d'abord le problème et ses causes, puis présente une méthode en étapes claires : principes, mise en œuvre étape par étape, erreurs fréquentes, plan d'action final.",
  },
  step_by_step: {
    label: "Formation pas-à-pas",
    structure:
      "Progression en modules du niveau débutant jusqu'à l'autonomie. Chaque chapitre fixe un objectif, enseigne une compétence, propose un exercice pratique et se termine par un récapitulatif.",
  },
  recipes: {
    label: "Recettes et fiches",
    structure:
      "Chapitres thématiques regroupant des fiches pratiques autonomes. Chaque fiche suit le même format : présentation, éléments nécessaires, étapes numérotées, astuces et variantes.",
  },
  business_money: {
    label: "Business et argent",
    structure:
      "Du constat de l'opportunité à la mise en œuvre : marché, modèle économique, chiffres et calculs simples, stratégie, étapes de lancement, études de cas, risques et pièges à éviter.",
  },
  free: {
    label: "Libre",
    structure: "Structure libre, la plus adaptée au sujet et à la promesse du livre.",
  },
};

/** Page ranges target about 250 words per A5 page. */
export const LENGTHS: Record<
  EbookLength,
  { label: string; chapters: [number, number]; wordsPerChapter: number }
> = {
  short: { label: "court (20 à 30 pages)", chapters: [6, 8], wordsPerChapter: 900 },
  standard: { label: "standard (50 à 70 pages)", chapters: [10, 12], wordsPerChapter: 1400 },
  complete: { label: "complet (plus de 100 pages)", chapters: [16, 20], wordsPerChapter: 1700 },
};

/** Writing is priced by length: one job kind per length. */
export const WRITE_KIND_BY_LENGTH: Record<EbookLength, string> = {
  short: "ebook_write_short",
  standard: "ebook_write_standard",
  complete: "ebook_write_complete",
};

export const COVER_PROPOSALS = 3;
