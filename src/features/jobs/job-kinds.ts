const LABELS: Record<string, string> = {
  engine_test: "Test du moteur",
  ebook: "Ebook",
  ad_visuals: "Visuels publicitaires",
  ad_videos: "Vidéos publicitaires",
  sales_copy: "Textes de vente",
  competitor_analysis: "Analyse de la concurrence",
};

export function jobKindLabel(kind: string): string {
  return LABELS[kind] ?? "Génération";
}
