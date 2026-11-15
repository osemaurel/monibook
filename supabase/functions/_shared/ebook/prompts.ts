import { z } from "../deps.ts";
import type { StructuredTextRequest } from "../services/text/index.ts";
import { type EbookLength, LENGTHS, TEMPLATE_STRUCTURES } from "./config.ts";
import type { ChapterRecord, EbookBible, EbookRecord } from "./types.ts";

const LANGUAGE_NAMES = { fr: "français", en: "anglais" } as const;

function system(language: "fr" | "en"): string {
  return [
    "Tu es auteur et éditeur professionnel de livres numériques pratiques, vendus en ligne par des créateurs indépendants.",
    "Tu écris des contenus concrets et utiles, sans remplissage, sans promesses exagérées ni affirmations invérifiables.",
    `Le livre est rédigé en ${LANGUAGE_NAMES[language]}.`,
    "Tu réponds uniquement avec le JSON demandé.",
  ].join(" ");
}

const orUnknown = (value: string | null) => value?.trim() || "non précisé";

function projectContext(ebook: EbookRecord): string {
  const template = ebook.template ? TEMPLATE_STRUCTURES[ebook.template] : null;
  return [
    `Sujet du livre : ${orUnknown(ebook.subject)}`,
    `Niche : ${orUnknown(ebook.project.niche)}`,
    `Angle : ${orUnknown(ebook.project.angle)}`,
    `Audience : ${orUnknown(ebook.project.audience)}`,
    `Promesse : ${orUnknown(ebook.project.promise)}`,
    template ? `Gabarit : ${template.label}. ${template.structure}` : null,
  ].filter(Boolean).join("\n");
}

const FORMAT_RULES = `Format du texte (obligatoire) :
- Ne répète pas le titre du chapitre en tête de texte.
- Sections avec « ## Titre de section », sous-sections avec « ### Titre ».
- Paragraphes séparés par une ligne vide ; **gras** et *italique* autorisés.
- Listes avec « - » ou « 1. », un élément par ligne.
- Citation : une ligne commençant par « > », auteur éventuel après « — ».
- Encadré : une ligne « :::encadre Titre de l'encadré », son contenu, puis une ligne « ::: ».
- Au moins un encadré pratique par chapitre. Ni HTML, ni tableau, ni lien.`;

// --- Step 2: titles ------------------------------------------------------------

export const TitlesOutput = z.object({
  titles: z.array(z.string().trim().min(3).max(120)).length(5),
});

export function titlesPrompt(ebook: EbookRecord): StructuredTextRequest {
  return {
    instructions: system(ebook.project.language),
    prompt: `${projectContext(ebook)}

Propose 5 titres différents pour ce livre numérique.
- Chaque titre fait moins de 70 caractères, sans guillemets ni numérotation.
- Concrets et orientés résultat, adaptés à l'audience.
- Varie les approches : bénéfice direct, méthode, chiffre, problème résolu, curiosité.`,
    temperature: 0.9,
  };
}

// --- Step 3: summary -----------------------------------------------------------

export const SummaryOutput = z.object({ summary: z.string().trim().min(200).max(2500) });

export function summaryPrompt(ebook: EbookRecord): StructuredTextRequest {
  return {
    instructions: system(ebook.project.language),
    prompt: `${projectContext(ebook)}
Titre retenu : ${ebook.title}${ebook.subtitle ? ` — ${ebook.subtitle}` : ""}

Rédige le résumé du livre (texte de présentation, 120 à 200 mots) : le problème du lecteur, la promesse,
ce que contient le livre, et pour qui il est écrit. Ton engageant, sans superlatifs creux.`,
    temperature: 0.7,
  };
}

// --- Step 5: outline -----------------------------------------------------------

export function outlineOutput(length: EbookLength) {
  const [min, max] = LENGTHS[length].chapters;
  return z.object({
    chapters: z.array(z.object({
      title: z.string().trim().min(3).max(120),
      brief: z.string().trim().min(20).max(600),
    })).min(min).max(max),
  });
}

export function outlinePrompt(ebook: EbookRecord): StructuredTextRequest {
  const length = LENGTHS[ebook.length!];
  return {
    instructions: system(ebook.project.language),
    prompt: `${projectContext(ebook)}
Titre : ${ebook.title}${ebook.subtitle ? ` — ${ebook.subtitle}` : ""}
Résumé : ${ebook.summary}
Format : ${length.label}
Ton : ${orUnknown(ebook.tone)}
${ebook.instructions ? `Consignes de l'auteur : ${ebook.instructions}` : ""}

Construis le plan du livre en suivant la structure du gabarit : entre ${length.chapters[0]} et ${
      length.chapters[1]
    } chapitres.
Pour chaque chapitre :
- « title » : un titre court et explicite, sans « Chapitre N ».
- « brief » : 2 à 3 phrases précises sur ce que le chapitre apporte et couvre.
Progression logique, aucun doublon, le premier chapitre accroche le lecteur, le dernier le fait passer à l'action.`,
    temperature: 0.6,
  };
}

// --- Step 6: bible, chapters, coherence ---------------------------------------

export const BibleOutput = z.object({
  audience_profile: z.string().trim().min(50).max(1500),
  voice_guidelines: z.string().trim().min(50).max(1500),
  key_messages: z.array(z.string().trim().min(5).max(300)).min(3).max(6),
  terminology: z.array(z.object({
    term: z.string().trim().min(1).max(80),
    definition: z.string().trim().min(5).max(300),
  })).max(12),
  rules: z.array(z.string().trim().min(5).max(300)).min(3).max(8),
});

export function biblePrompt(ebook: EbookRecord, chapters: ChapterRecord[]): StructuredTextRequest {
  return {
    instructions: system(ebook.project.language),
    prompt: `${projectContext(ebook)}
Titre : ${ebook.title}${ebook.subtitle ? ` — ${ebook.subtitle}` : ""}
Résumé : ${ebook.summary}
Ton demandé : ${orUnknown(ebook.tone)}
${ebook.instructions ? `Consignes de l'auteur : ${ebook.instructions}` : ""}
Plan :
${chapters.map((c, i) => `${i + 1}. ${c.title} — ${c.brief ?? ""}`).join("\n")}

Prépare la « bible » de rédaction qui guidera chaque chapitre :
- « audience_profile » : qui lit, son niveau, ses blocages, ce qu'il attend.
- « voice_guidelines » : comment le texte s'adresse au lecteur (personne, registre, rythme, exemples).
- « key_messages » : 3 à 6 idées fortes que tout le livre doit porter.
- « terminology » : les termes à employer de façon constante, avec leur définition.
- « rules » : 3 à 8 règles d'écriture à respecter dans chaque chapitre.`,
    temperature: 0.4,
  };
}

export function buildBible(
  ebook: EbookRecord,
  chapters: ChapterRecord[],
  generated: z.infer<typeof BibleOutput>,
): EbookBible {
  return {
    title: ebook.title!,
    subtitle: ebook.subtitle,
    author: ebook.author_name!,
    language: ebook.project.language,
    template: ebook.template!,
    length: ebook.length!,
    promise: orUnknown(ebook.project.promise),
    audience: orUnknown(ebook.project.audience),
    tone: ebook.tone!,
    instructions: ebook.instructions,
    summary: ebook.summary!,
    ...generated,
    outline: chapters.map((c, i) => ({ number: i + 1, title: c.title, brief: c.brief ?? "" })),
  };
}

export function renderBible(bible: EbookBible): string {
  return [
    `Titre : ${bible.title}${bible.subtitle ? ` — ${bible.subtitle}` : ""} (auteur : ${bible.author})`,
    `Gabarit : ${TEMPLATE_STRUCTURES[bible.template].label}. ${
      TEMPLATE_STRUCTURES[bible.template].structure
    }`,
    `Promesse : ${bible.promise}`,
    `Audience : ${bible.audience}`,
    `Profil du lecteur : ${bible.audience_profile}`,
    `Ton : ${bible.tone}. ${bible.voice_guidelines}`,
    bible.instructions ? `Consignes de l'auteur : ${bible.instructions}` : null,
    `Résumé : ${bible.summary}`,
    `Messages clés :\n${bible.key_messages.map((m) => `- ${m}`).join("\n")}`,
    bible.terminology.length > 0
      ? `Terminologie :\n${bible.terminology.map((t) => `- ${t.term} : ${t.definition}`).join("\n")}`
      : null,
    `Règles d'écriture :\n${bible.rules.map((r) => `- ${r}`).join("\n")}`,
    `Plan complet :\n${bible.outline.map((c) => `${c.number}. ${c.title} — ${c.brief}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");
}

export const ChapterOutput = z.object({
  content: z.string().trim().min(300).max(60_000),
  summary: z.string().trim().min(40).max(1500),
});

export interface WrittenChapter {
  number: number;
  title: string;
  summary: string;
}

export function chapterPrompt(
  bible: EbookBible,
  previous: WrittenChapter[],
  chapter: { number: number; title: string; brief: string | null },
  total: number,
  next: { title: string } | undefined,
): StructuredTextRequest {
  const words = LENGTHS[bible.length].wordsPerChapter;
  return {
    instructions: system(bible.language),
    prompt: `BIBLE DU LIVRE (référence à respecter strictement)
${renderBible(bible)}

CHAPITRES DÉJÀ RÉDIGÉS
${
      previous.length > 0
        ? previous.map((c) => `Chapitre ${c.number} — ${c.title} : ${c.summary}`).join("\n")
        : "Aucun : c'est le premier chapitre."
    }

CHAPITRE À RÉDIGER
Chapitre ${chapter.number} sur ${total} : « ${chapter.title} »
Ce qu'il doit couvrir : ${chapter.brief ?? "selon le plan"}
${
      next
        ? `Chapitre suivant : « ${next.title} » — termine par une transition naturelle vers lui.`
        : "C'est le dernier chapitre : termine en faisant passer le lecteur à l'action."
    }

CONSIGNES
- Environ ${words} mots.
- Respecte le ton, les messages clés, la terminologie et les règles de la bible.
- Ne répète pas ce que les chapitres précédents ont déjà traité ; fais-y référence si c'est utile.
- Concret : exemples, chiffres réalistes, étapes applicables immédiatement.
${FORMAT_RULES}

Renvoie « content » (le texte du chapitre) et « summary » (60 à 100 mots résumant ce que le chapitre
a réellement couvert ; il servira à rédiger la suite).`,
    temperature: 0.7,
    maxOutputTokens: 8000,
  };
}

export const CoherenceOutput = z.object({
  edits: z.array(z.object({
    number: z.number().int().min(1),
    opening: z.string().trim().min(20).max(2000).optional(),
    closing: z.string().trim().min(20).max(2000).optional(),
  })).max(40),
  notes: z.string().trim().max(2000),
});

export interface ChapterExcerpt {
  number: number;
  title: string;
  summary: string;
  opening: string;
  closing: string;
}

export function coherencePrompt(bible: EbookBible, chapters: ChapterExcerpt[]): StructuredTextRequest {
  return {
    instructions: system(bible.language),
    prompt: `BIBLE DU LIVRE
${renderBible(bible)}

CHAPITRES RÉDIGÉS (résumé, premier et dernier paragraphe)
${
      chapters.map((c) =>
        `Chapitre ${c.number} — ${c.title}\nRésumé : ${c.summary}\nOuverture : ${c.opening}\nClôture : ${c.closing}`
      ).join("\n\n")
    }

Fais une passe de cohérence sur l'ensemble du livre :
- transitions entre chapitres (chaque clôture doit amener le chapitre suivant, chaque ouverture s'appuyer sur le précédent) ;
- terminologie identique d'un chapitre à l'autre, conforme à la bible ;
- aucune contradiction ni répétition d'un chapitre à l'autre.
Dans « edits », ne propose que les paragraphes à remplacer (« opening » et/ou « closing », par numéro de chapitre),
réécrits dans le même format. Dans « notes », résume en quelques phrases ce que tu as harmonisé.`,
    temperature: 0.3,
    maxOutputTokens: 8000,
  };
}

// --- Step 8: rewrite one chapter ----------------------------------------------

export function rewritePrompt(
  bible: EbookBible,
  others: WrittenChapter[],
  chapter: { number: number; title: string; brief: string | null; content: string | null },
  total: number,
  instructions: string | undefined,
): StructuredTextRequest {
  const words = LENGTHS[bible.length].wordsPerChapter;
  return {
    instructions: system(bible.language),
    prompt: `BIBLE DU LIVRE (référence à respecter strictement)
${renderBible(bible)}

AUTRES CHAPITRES DU LIVRE
${others.map((c) => `Chapitre ${c.number} — ${c.title} : ${c.summary}`).join("\n") || "Aucun."}

CHAPITRE À RÉÉCRIRE
Chapitre ${chapter.number} sur ${total} : « ${chapter.title} »
Ce qu'il doit couvrir : ${chapter.brief ?? "selon le plan"}
${chapter.content ? `Version actuelle :\n${chapter.content}` : "Ce chapitre n'a pas encore de texte."}

${instructions ? `DEMANDE DE L'AUTEUR\n${instructions}\n` : ""}
CONSIGNES
- Environ ${words} mots, cohérent avec les autres chapitres, sans les répéter.
${FORMAT_RULES}

Renvoie « content » (le chapitre réécrit) et « summary » (60 à 100 mots).`,
    temperature: 0.7,
    maxOutputTokens: 8000,
  };
}

// --- Step 7: cover -------------------------------------------------------------

const COVER_STYLES: Record<EbookRecord["template"] & string, string> = {
  method_guide: "clean editorial illustration, calm and confident",
  step_by_step: "friendly modern illustration suggesting progress and learning",
  recipes: "appetizing, warm, natural light still life",
  business_money: "premium, bold and modern, subtle geometric shapes",
  free: "elegant editorial illustration",
};

/** The artwork carries no text: the title and author are typeset over it. */
export function coverPrompt(ebook: EbookRecord): string {
  return [
    `Ebook cover artwork, portrait format, about: ${ebook.subject ?? ebook.title}.`,
    `Niche: ${orUnknown(ebook.project.niche)}. Mood: ${orUnknown(ebook.tone)}.`,
    `Style: ${COVER_STYLES[ebook.template ?? "free"]}.`,
    "Absolutely no text, letters, numbers or logos. Keep the upper third uncluttered for the title.",
  ].join(" ");
}
