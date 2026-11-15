const LABELS: Record<string, string> = {
  engine_test: "Test du moteur",
  ebook: "Ebook",
  ad_visuals: "Visuels publicitaires",
  ad_videos: "Vidéos publicitaires",
  sales_copy: "Textes de vente",
  competitor_analysis: "Analyse de la concurrence",
  ebook_titles: "Titres de l'ebook",
  ebook_summary: "Résumé de l'ebook",
  ebook_outline: "Plan de l'ebook",
  ebook_write_short: "Rédaction de l'ebook (court)",
  ebook_write_standard: "Rédaction de l'ebook (standard)",
  ebook_write_complete: "Rédaction de l'ebook (complet)",
  ebook_cover: "Couvertures de l'ebook",
  ebook_chapter_rewrite: "Réécriture d'un chapitre",
};

export function jobKindLabel(kind: string): string {
  return LABELS[kind] ?? "Génération";
}
