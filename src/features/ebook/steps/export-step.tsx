import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentProject } from "@/features/projects/project-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useChapters } from "../api";
import { CoverArt, StepSection } from "../components";
import { EXPORT_TEMPLATES, type ExportTemplate } from "../config";
import { downloadText, ebookToText, fileSlug } from "../export-text";
import type { PrintableBook } from "../pdf/build-html";
import { fileToDataUrl, openPrintWindow } from "../pdf/open-print";
import { type EbookStepProps, useAdvance } from "./shared";

const SAMPLE_FONTS: Record<ExportTemplate, string> = {
  classic: "font-serif",
  modern: "font-sans font-extrabold",
  elegant: "font-serif italic font-light",
};

export function ExportStep({ ebook, goTo }: EbookStepProps) {
  const project = useCurrentProject();
  const chapters = useChapters(ebook.id);
  const { update } = useAdvance(ebook, goTo);
  const template = (ebook.export_template as ExportTemplate) ?? "classic";
  const list = chapters.data ?? [];
  const author = ebook.author_name ?? "";
  const title = ebook.title ?? project.name;

  async function loadBook(): Promise<PrintableBook> {
    let coverDataUrl: string | null = null;
    if (ebook.cover_path) {
      const { data } = await supabase.storage.from("assets").createSignedUrl(ebook.cover_path, 600);
      if (data) coverDataUrl = await fileToDataUrl(data.signedUrl);
    }
    return {
      title,
      subtitle: ebook.subtitle,
      author,
      language: project.language,
      coverDataUrl,
      chapters: list.map((c) => ({ title: c.title, content: c.content })),
    };
  }

  function exportPdf() {
    if (!openPrintWindow(loadBook, template)) {
      toast.error("Votre navigateur a bloqué l'ouverture de l'onglet. Autorisez les fenêtres pour Monibook.");
    }
  }

  function exportText() {
    downloadText(
      `${fileSlug(title)}.txt`,
      ebookToText({ title, subtitle: ebook.subtitle, author, chapters: list }),
    );
  }

  return (
    <StepSection
      title="Export"
      description="Le PDF est mis en page dans un nouvel onglet, avec page de titre, sommaire cliquable, en-têtes et numéros de page."
    >
      {ebook.cover_path && (
        <CoverArt path={ebook.cover_path} title={title} subtitle={ebook.subtitle} author={author} className="w-32 text-[11px]" />
      )}
      <div role="radiogroup" aria-label="Gabarit typographique" className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(EXPORT_TEMPLATES) as ExportTemplate[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={template === value}
            onClick={() => update({ export_template: value })}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left",
              template === value && "border-foreground bg-muted/50",
            )}
          >
            <span className={cn("text-2xl", SAMPLE_FONTS[value])} aria-hidden>Aa</span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">{EXPORT_TEMPLATES[value].label}</span>
              <span className="text-xs text-muted-foreground">{EXPORT_TEMPLATES[value].description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={list.length === 0} onClick={exportPdf}>
          <FileDown /> Créer le PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Dans l'onglet qui s'ouvre, choisissez « Enregistrer au format PDF » comme imprimante. Aucun filigrane.
        </p>
        <Button size="lg" variant="outline" disabled={list.length === 0} onClick={exportText}>
          <FileText /> Télécharger le texte (.txt)
        </Button>
      </div>
    </StepSection>
  );
}
