const LABELS: Record<string, string> = {
  engine_test: "Test du moteur",
  ebook: "Ebook",
  ad_visuals: "Lot de visuels publicitaires",
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
  copy_hooks: "Textes : accroches et titres de pub",
  copy_facebook_short: "Textes : Facebook court",
  copy_facebook_long: "Textes : Facebook long",
  copy_sales_page: "Textes : page de vente",
  copy_email_sequence: "Textes : e-mails de lancement",
  copy_product_description: "Textes : description produit",
  copy_social_captions: "Textes : légendes réseaux sociaux",
  copy_free: "Textes : mode libre",
};

export function jobKindLabel(kind: string): string {
  return LABELS[kind] ?? "Génération";
}
