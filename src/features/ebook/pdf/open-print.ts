import pagedScriptPath from "paged-polyfill?url";
import type { ExportTemplate } from "../config";
import { buildEbookHtml, type PrintableBook } from "./build-html";

export async function fileToDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Opens the laid-out book in a new tab: Paged.js paginates it (title page, clickable contents,
 * running heads, page numbers), then the browser converts it to PDF through the print dialog.
 * The tab is opened synchronously, inside the click, so it is not blocked; the book loads after.
 */
export function openPrintWindow(loadBook: () => Promise<PrintableBook>, template: ExportTemplate): boolean {
  const tab = window.open("", "_blank");
  if (!tab) return false;
  tab.document.write(
    '<p style="font:16px system-ui,sans-serif;padding:24px">Mise en page de votre ebook en cours…</p>',
  );

  loadBook()
    .then((book) => {
      const html = buildEbookHtml(book, template, {
        pagedScriptUrl: new URL(pagedScriptPath, window.location.origin).href,
        autoPrint: true,
      });
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    })
    .catch(() => {
      tab.document.body.innerHTML =
        '<p style="font:16px system-ui,sans-serif;padding:24px">La mise en page n\'a pas pu être préparée. Fermez cet onglet et réessayez.</p>';
    });
  return true;
}
