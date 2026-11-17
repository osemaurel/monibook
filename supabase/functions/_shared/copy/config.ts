import { z } from "../deps.ts";

// Types of sales copy, their structure and how each is turned into ready-to-paste text.
// The client keeps the same ids, labels and job kinds.

export const COPY_ANGLES = {
  emotional: {
    label: "Émotionnel",
    direction:
      "parlez au ressenti : la frustration actuelle du lecteur, puis le soulagement et la fierté une fois le résultat atteint. Images concrètes du quotidien.",
  },
  numbers: {
    label: "Chiffré",
    direction:
      "appuyez-vous sur des chiffres concrets : prix, durée, nombre de chapitres, temps gagné, économies. N'utilisez que les chiffres fournis ; pour tout autre chiffre, laissez un emplacement entre crochets comme [chiffre à vérifier].",
  },
  testimonial: {
    label: "Témoignage",
    direction:
      "construisez le texte autour de l'histoire d'un client type, avant et après. N'inventez jamais un témoignage présenté comme réel : utilisez des emplacements entre crochets, par exemple [Prénom du client], [ville] ou [résultat obtenu], que l'auteur remplacera par un vrai avis.",
  },
  urgency: {
    label: "Urgence",
    direction:
      "donnez une raison d'agir maintenant : coût de l'attente, problème qui s'aggrave, opportunité à saisir. N'inventez ni fausse échéance ni faux stock : si une date ou une limite est utile, laissez un emplacement comme [date limite].",
  },
} as const;
export type CopyAngle = keyof typeof COPY_ANGLES;
export const COPY_ANGLE_IDS = Object.keys(COPY_ANGLES) as CopyAngle[];

/** Free mode: three distinct approaches instead of the four marketing angles. */
export const FREE_APPROACHES = [
  "directe et concise",
  "chaleureuse et narrative",
  "percutante et orientée vers l'action",
] as const;

type Labels = {
  email: string;
  day: string;
  subject: string;
  preview: string;
  headline: string;
  description: string;
};
const LABELS: Record<"fr" | "en", Labels> = {
  fr: {
    email: "E-MAIL",
    day: "Jour",
    subject: "Objet",
    preview: "Aperçu",
    headline: "Titre",
    description: "Description",
  },
  en: {
    email: "EMAIL",
    day: "Day",
    subject: "Subject",
    preview: "Preview",
    headline: "Headline",
    description: "Description",
  },
};

const text = (min: number, max: number, description: string) =>
  z.string().min(min).max(max).describe(description);

const FacebookAd = (min: number, max: number, words: string) =>
  z.object({
    primary_text: text(
      min,
      max,
      `Texte principal de la publicité, ${words}, avec des retours à la ligne aérés`,
    ),
    headline: text(3, 60, "Titre affiché sous l'image, 40 caractères visés"),
    description: text(3, 60, "Description courte sous le titre, 30 caractères visés"),
  });

export const COPY_TYPES = {
  hooks: {
    kind: "copy_hooks",
    label: "Accroches et titres de pub",
    brief:
      "Rédigez des accroches publicitaires (première phrase d'une publicité ou d'une vidéo, qui arrête le défilement) et des titres de publicité courts.",
    schema: z.object({
      hooks: z.array(text(5, 160, "Une accroche d'une ou deux phrases")).min(6).max(10),
      headlines: z.array(text(3, 60, "Un titre de publicité de 40 caractères environ")).min(3).max(6),
    }),
    render: (d: { hooks: string[]; headlines: string[] }, lang: "fr" | "en") =>
      [
        lang === "fr" ? "ACCROCHES" : "HOOKS",
        ...d.hooks.map((h, i) => `${i + 1}. ${h}`),
        "",
        lang === "fr" ? "TITRES DE PUB" : "AD HEADLINES",
        ...d.headlines.map((h, i) => `${i + 1}. ${h}`),
      ].join("\n"),
  },
  facebook_short: {
    kind: "copy_facebook_short",
    label: "Texte Facebook court",
    brief: "Rédigez une publicité Facebook courte, lisible en quelques secondes sur mobile.",
    schema: FacebookAd(40, 900, "40 à 90 mots"),
    render: (d: { primary_text: string; headline: string; description: string }, lang: "fr" | "en") =>
      `${d.primary_text}\n\n${LABELS[lang].headline} : ${d.headline}\n${
        LABELS[lang].description
      } : ${d.description}`,
  },
  facebook_long: {
    kind: "copy_facebook_long",
    label: "Texte Facebook long",
    brief:
      "Rédigez une publicité Facebook longue au format récit : accroche, problème, découverte de la solution, bénéfices, offre, appel à l'action.",
    schema: FacebookAd(600, 3500, "200 à 350 mots"),
    render: (d: { primary_text: string; headline: string; description: string }, lang: "fr" | "en") =>
      `${d.primary_text}\n\n${LABELS[lang].headline} : ${d.headline}\n${
        LABELS[lang].description
      } : ${d.description}`,
  },
  sales_page: {
    kind: "copy_sales_page",
    label: "Argumentaire de page de vente",
    brief:
      "Rédigez l'argumentaire complet d'une page de vente, section par section : grand titre, sous-titre, problème, solution, bénéfices, contenu du produit, preuve, offre et prix, garantie, questions fréquentes, appel à l'action final.",
    schema: z.object({
      sections: z
        .array(z.object({
          heading: text(2, 120, "Titre de la section"),
          body: text(20, 4000, "Contenu de la section, prêt à publier"),
        }))
        .min(6)
        .max(14),
    }),
    render: (d: { sections: { heading: string; body: string }[] }) =>
      d.sections.map((s) => `${s.heading.toUpperCase()}\n\n${s.body}`).join("\n\n"),
  },
  email_sequence: {
    kind: "copy_email_sequence",
    label: "Séquence d'e-mails de lancement",
    brief:
      "Rédigez une séquence d'e-mails de lancement de 5 e-mails sur une semaine : annonce, valeur, preuve, objections, dernier rappel. Chaque e-mail a un objet, un texte d'aperçu et un corps.",
    schema: z.object({
      emails: z
        .array(z.object({
          send_day: z.number().int().min(0).max(30).describe("Jour d'envoi, 0 = jour du lancement"),
          subject: text(3, 120, "Objet de l'e-mail"),
          preview: text(3, 160, "Texte d'aperçu affiché après l'objet"),
          body: text(50, 4000, "Corps de l'e-mail, avec appel à l'action"),
        }))
        .min(4)
        .max(7),
    }),
    render: (
      d: { emails: { send_day: number; subject: string; preview: string; body: string }[] },
      lang: "fr" | "en",
    ) =>
      d.emails
        .map((e, i) => {
          const l = LABELS[lang];
          return `${l.email} ${
            i + 1
          } · ${l.day} ${e.send_day}\n${l.subject} : ${e.subject}\n${l.preview} : ${e.preview}\n\n${e.body}`;
        })
        .join("\n\n――――――――――\n\n"),
  },
  product_description: {
    kind: "copy_product_description",
    label: "Description produit",
    brief:
      "Rédigez la description du produit pour une boutique en ligne ou une page de paiement : une phrase d'accroche, une description de 120 à 200 mots et les points clés.",
    schema: z.object({
      tagline: text(5, 200, "Phrase d'accroche du produit"),
      description: text(100, 2500, "Description de 120 à 200 mots"),
      bullets: z.array(text(3, 200, "Un point clé du produit")).min(3).max(7),
    }),
    render: (d: { tagline: string; description: string; bullets: string[] }) =>
      `${d.tagline}\n\n${d.description}\n\n${d.bullets.map((b) => `• ${b}`).join("\n")}`,
  },
  social_captions: {
    kind: "copy_social_captions",
    label: "Légendes réseaux sociaux",
    brief:
      "Rédigez des légendes de publications pour Instagram, Facebook, TikTok et les statuts WhatsApp, chacune avec quelques hashtags pertinents.",
    schema: z.object({
      captions: z
        .array(z.object({
          text: text(20, 1200, "Légende prête à publier"),
          hashtags: z.array(text(2, 40, "Un hashtag")).max(8),
        }))
        .min(3)
        .max(6),
    }),
    render: (d: { captions: { text: string; hashtags: string[] }[] }) =>
      d.captions
        .map((c, i) => {
          const tags = c.hashtags
            .map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, ""))
            .filter((h) => h.length > 1)
            .join(" ");
          return `${i + 1}.\n${c.text}${tags ? `\n${tags}` : ""}`;
        })
        .join("\n\n"),
  },
  free: {
    kind: "copy_free",
    label: "Mode libre",
    brief: "Rédigez le texte demandé par l'auteur.",
    schema: z.object({
      title: text(2, 80, "Titre court qui décrit ce texte"),
      content: text(10, 8000, "Le texte demandé, prêt à utiliser"),
    }),
    render: (d: { title: string; content: string }) => d.content,
  },
} as const;
export type CopyType = keyof typeof COPY_TYPES;

export const COPY_KINDS: Record<string, CopyType> = Object.fromEntries(
  Object.entries(COPY_TYPES).map(([type, def]) => [def.kind, type as CopyType]),
);
