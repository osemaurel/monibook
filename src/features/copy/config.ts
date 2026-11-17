import type { Enums } from "@/lib/database.types";

// Same ids and job kinds as the server (supabase/functions/_shared/copy/config.ts).

export type CopyType = Enums<"copy_type">;
export type CopyAngle = Enums<"copy_angle">;

export interface CopyTypeDefinition {
  id: CopyType;
  kind: string;
  label: string;
  description: string;
}

/** The entry points of the Texts screen. Free mode comes after them, not first. */
export const COPY_TYPES: CopyTypeDefinition[] = [
  {
    id: "hooks",
    kind: "copy_hooks",
    label: "Accroches et titres de pub",
    description: "Des premières phrases qui arrêtent le défilement et des titres courts.",
  },
  {
    id: "facebook_short",
    kind: "copy_facebook_short",
    label: "Texte Facebook court",
    description: "Une publicité lue en quelques secondes, avec son titre et sa description.",
  },
  {
    id: "facebook_long",
    kind: "copy_facebook_long",
    label: "Texte Facebook long",
    description: "Une publicité racontée, de l'accroche à l'appel à l'action.",
  },
  {
    id: "sales_page",
    kind: "copy_sales_page",
    label: "Argumentaire de page de vente",
    description: "Toutes les sections d'une page de vente, du grand titre aux questions fréquentes.",
  },
  {
    id: "email_sequence",
    kind: "copy_email_sequence",
    label: "Séquence d'e-mails de lancement",
    description: "5 e-mails sur une semaine, avec objets et textes d'aperçu.",
  },
  {
    id: "product_description",
    kind: "copy_product_description",
    label: "Description produit",
    description: "Accroche, description et points clés pour votre boutique ou page de paiement.",
  },
  {
    id: "social_captions",
    kind: "copy_social_captions",
    label: "Légendes réseaux sociaux",
    description: "Des légendes prêtes à publier, avec leurs hashtags.",
  },
];

export const FREE_TYPE: CopyTypeDefinition = {
  id: "free",
  kind: "copy_free",
  label: "Mode libre",
  description: "Décrivez le texte dont vous avez besoin : message WhatsApp, script, réponse à un client…",
};

export const ALL_COPY_TYPES = [...COPY_TYPES, FREE_TYPE];
export const COPY_JOB_KINDS = ALL_COPY_TYPES.map((t) => t.kind);

export function copyType(id: string | null): CopyTypeDefinition | undefined {
  return ALL_COPY_TYPES.find((t) => t.id === id);
}

export const COPY_ANGLES: Record<CopyAngle, string> = {
  emotional: "Émotionnel",
  numbers: "Chiffré",
  testimonial: "Témoignage",
  urgency: "Urgence",
};

export const VARIATIONS_BY_TYPE = (type: CopyType) => (type === "free" ? 3 : 4);
export const INSTRUCTIONS_MAX_LENGTH = 1000;
export const FREE_REQUEST_MIN_LENGTH = 10;
export const FREE_REQUEST_MAX_LENGTH = 2000;
export const TITLE_MAX_LENGTH = 120;

export interface CopyVariation {
  angle: CopyAngle | null;
  title: string;
  content: string;
}

/** Variations stored in a finished job's output. */
export function jobVariations(output: unknown): CopyVariation[] {
  const variations = (output as { variations?: unknown } | null)?.variations;
  if (!Array.isArray(variations)) return [];
  return variations.filter((v): v is CopyVariation =>
    typeof v?.content === "string" && typeof v?.title === "string"
  );
}

/** Placeholders the author must fill in before publishing: [Prénom du client], [date limite]… */
export function hasPlaceholders(text: string): boolean {
  return /\[[^\]\n]{2,60}\]/.test(text);
}
