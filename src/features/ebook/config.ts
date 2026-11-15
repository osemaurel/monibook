import type { Enums } from "@/lib/database.types";

export type EbookTemplate = Enums<"ebook_template">;
export type EbookLength = Enums<"ebook_length">;
export type ExportTemplate = "classic" | "modern" | "elegant";

export const TEMPLATES: Record<EbookTemplate, { label: string; description: string }> = {
  method_guide: {
    label: "Guide méthode",
    description: "Un problème, puis une méthode en étapes : principes, mise en œuvre, erreurs à éviter, plan d'action.",
  },
  step_by_step: {
    label: "Formation pas-à-pas",
    description: "Des modules progressifs : un objectif, une compétence, un exercice et un récapitulatif par chapitre.",
  },
  recipes: {
    label: "Recettes et fiches",
    description: "Des chapitres thématiques de fiches pratiques au même format : éléments, étapes, astuces.",
  },
  business_money: {
    label: "Business et argent",
    description: "De l'opportunité au lancement : marché, modèle, chiffres, stratégie, études de cas, pièges.",
  },
  free: {
    label: "Libre",
    description: "Une structure libre, adaptée à votre sujet.",
  },
};

export const LENGTHS: Record<EbookLength, { label: string; pages: string; chapters: [number, number]; writeKind: string }> = {
  short: { label: "Court", pages: "20 à 30 pages", chapters: [6, 8], writeKind: "ebook_write_short" },
  standard: { label: "Standard", pages: "50 à 70 pages", chapters: [10, 12], writeKind: "ebook_write_standard" },
  complete: { label: "Complet", pages: "plus de 100 pages", chapters: [16, 20], writeKind: "ebook_write_complete" },
};

export const WRITE_KINDS = Object.values(LENGTHS).map((l) => l.writeKind);

export const TONES = [
  "Chaleureux et pédagogique",
  "Expert et direct",
  "Motivant et énergique",
  "Simple et bienveillant",
  "Factuel et rigoureux",
];

export const EXPORT_TEMPLATES: Record<ExportTemplate, { label: string; description: string }> = {
  classic: { label: "Classique", description: "Sérif, texte justifié, lettrine en début de chapitre." },
  modern: { label: "Moderne", description: "Sans sérif, aéré, numéros de chapitre en couleur." },
  elegant: { label: "Élégant", description: "Grands titres fins, marges généreuses, filets discrets." },
};

export const STEPS = [
  "Sujet",
  "Titre",
  "Résumé",
  "Cadrage",
  "Plan",
  "Rédaction",
  "Couverture",
  "Éditeur",
  "Export",
] as const;
