// Same ids as the server (supabase/functions/_shared/visuals/config.ts).

export const VISUALS_JOB_KIND = "ad_visuals";

export const VISUAL_FORMATS = {
  square: { label: "Carré", ratio: "1:1", size: "1080 × 1080", use: "Fil Facebook et Instagram", aspect: "aspect-square" },
  vertical: {
    label: "Vertical",
    ratio: "9:16",
    size: "1080 × 1920",
    use: "Stories, reels, statuts WhatsApp, TikTok",
    aspect: "aspect-[9/16]",
  },
} as const;
export type VisualFormat = keyof typeof VISUAL_FORMATS;

export const VISUAL_STYLES = {
  clean: { label: "Épuré", description: "Fond clair, beaucoup d'espace, sobre", swatch: ["#f8fafc", "#0f172a", "#2563eb"] },
  bold: { label: "Audacieux", description: "Couleurs vives, gros titres, contrastes", swatch: ["#f43f5e", "#facc15", "#111827"] },
  elegant: { label: "Élégant", description: "Fond sombre, accents dorés, premium", swatch: ["#111827", "#d4af37", "#f5f5f4"] },
  warm: { label: "Chaleureux", description: "Tons chauds, ambiance humaine", swatch: ["#c2410c", "#fbbf24", "#fff7ed"] },
  modern: { label: "Moderne", description: "Dégradés, formes géométriques, net", swatch: ["#7c3aed", "#06b6d4", "#0f172a"] },
} as const;
export type VisualStyle = keyof typeof VISUAL_STYLES;

export const VISUAL_CONCEPTS = {
  product: "Produit en vedette",
  benefits: "Bénéfices",
  promise: "Promesse",
  offer: "Offre",
} as const;
export type VisualConcept = keyof typeof VISUAL_CONCEPTS;

export const VARIATIONS_PER_BATCH = 4;
export const HEADLINE_MAX_LENGTH = 90;
export const PROMISE_MAX_LENGTH = 300;
/** Only the first ones fit on a visual. */
export const BENEFITS_ON_VISUAL = 3;
