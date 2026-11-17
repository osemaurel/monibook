// Formats, styles and concepts of the ad visuals. The client keeps the same ids and labels.

export const VISUAL_FORMATS = {
  square: {
    label: "carré",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    use: "fil d'actualité Facebook et Instagram",
  },
  vertical: {
    label: "vertical",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    use: "stories, reels, statuts WhatsApp et TikTok",
  },
} as const;
export type VisualFormat = keyof typeof VISUAL_FORMATS;
export const VISUAL_FORMAT_IDS = Object.keys(VISUAL_FORMATS) as [VisualFormat, ...VisualFormat[]];

export const VISUAL_STYLES = {
  clean: {
    label: "Épuré",
    direction:
      "fond clair et uni, beaucoup d'espace vide, typographie sans empattement sobre, une seule couleur d'accent",
  },
  bold: {
    label: "Audacieux",
    direction:
      "couleurs vives et saturées, titres très gros en gras, contrastes forts, formes graphiques dynamiques",
  },
  elegant: {
    label: "Élégant",
    direction:
      "fond sombre, accents dorés, typographie à empattements raffinée, mise en page aérée et premium",
  },
  warm: {
    label: "Chaleureux",
    direction: "tons chauds (orange, ocre, terracotta), lumière naturelle, ambiance humaine et accueillante",
  },
  modern: {
    label: "Moderne",
    direction: "dégradés lumineux, formes géométriques, effets de verre dépoli, rendu net et technologique",
  },
} as const;
export type VisualStyle = keyof typeof VISUAL_STYLES;
export const VISUAL_STYLE_IDS = Object.keys(VISUAL_STYLES) as [VisualStyle, ...VisualStyle[]];

/** One batch = these four creative concepts, so the variations really differ. */
export const VISUAL_CONCEPTS = [
  {
    id: "product",
    label: "Produit en vedette",
    direction:
      "le produit est la star : une maquette réaliste de l'ebook (couverture en 3D, posée ou tenue en main) au centre, le titre au-dessus, le prix bien visible",
  },
  {
    id: "benefits",
    label: "Bénéfices",
    direction:
      "le titre en haut puis les bénéfices sous forme de liste cochée, très lisible, comme une fiche claire de ce que l'on obtient",
  },
  {
    id: "promise",
    label: "Promesse",
    direction:
      "une scène de vie qui montre le résultat obtenu par une personne du public visé, avec la promesse en grand, ton émotionnel",
  },
  {
    id: "offer",
    label: "Offre",
    direction:
      "l'offre au premier plan : prix mis en avant dans un macaron, garantie en badge rassurant, bouton d'appel à l'action très visible",
  },
] as const;
export type VisualConcept = (typeof VISUAL_CONCEPTS)[number]["id"];

export const VARIATIONS_PER_BATCH = VISUAL_CONCEPTS.length;

export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_EXTENSIONS).map(([mime, ext]) => [ext, mime]),
);
