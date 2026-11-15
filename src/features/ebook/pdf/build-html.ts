import type { ExportTemplate } from "../config";
import { inlineHtml, markupToHtml } from "../markup";
import { printStylesheet } from "./templates";

export interface PrintableBook {
  title: string;
  subtitle: string | null;
  author: string;
  language: "fr" | "en";
  /** Cover artwork embedded as a data URL, so it is loaded before pagination. */
  coverDataUrl: string | null;
  chapters: { title: string; content: string | null }[];
}

const LABELS = {
  fr: { contents: "Sommaire", chapter: "Chapitre", thanks: "Merci de votre lecture.", rights: "Tous droits réservés." },
  en: { contents: "Contents", chapter: "Chapter", thanks: "Thank you for reading.", rights: "All rights reserved." },
};

export interface PrintOptions {
  /** URL of the Paged.js script; without it the HTML is returned unpaginated (tests). */
  pagedScriptUrl?: string;
  /** Opens the print dialog once pagination is done. */
  autoPrint?: boolean;
}

// Runs in the print window: marks the document ready, adds a print button (outside the pages).
function afterPaginationScript(autoPrint: boolean): string {
  return `window.PagedConfig = {
  auto: true,
  after: function () {
    document.documentElement.setAttribute("data-paged", "ready");
    var bar = document.createElement("div");
    bar.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;padding:12px 16px;background:#18181b;color:#fff;font:14px system-ui,sans-serif;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;z-index:10");
    bar.className = "print-bar";
    bar.innerHTML = '<span>Choisissez « Enregistrer au format PDF » comme imprimante.</span>';
    var button = document.createElement("button");
    button.textContent = "Enregistrer en PDF";
    button.setAttribute("style", "padding:8px 14px;border-radius:8px;border:0;background:#fff;color:#18181b;font-weight:600");
    button.onclick = function () { window.print(); };
    bar.appendChild(button);
    document.body.appendChild(bar);
    var style = document.createElement("style");
    style.textContent = "@media print { .print-bar { display: none !important; } }";
    document.head.appendChild(style);
    ${autoPrint ? "setTimeout(function () { window.print(); }, 400);" : ""}
  }
};`;
}

export function buildEbookHtml(book: PrintableBook, template: ExportTemplate, options: PrintOptions = {}): string {
  const labels = LABELS[book.language];
  const year = new Date().getFullYear();
  const esc = inlineHtml;

  const cover = `<section class="cover">
  ${book.coverDataUrl ? `<img src="${book.coverDataUrl}" alt="">` : ""}
  <div class="cover-text"><h1>${esc(book.title)}</h1>${book.subtitle ? `<p class="subtitle">${esc(book.subtitle)}</p>` : ""}</div>
  <p class="author">${esc(book.author)}</p>
</section>`;

  const titlePage = `<section class="title-page">
  <h1>${esc(book.title)}</h1>
  ${book.subtitle ? `<p class="subtitle">${esc(book.subtitle)}</p>` : ""}
  <p class="author">${esc(book.author)}</p>
</section>`;

  const toc = `<nav class="toc"><h2>${labels.contents}</h2><ol>
${
    book.chapters.map((c, i) =>
      `<li><a href="#chapitre-${i + 1}"><span class="toc-number">${i + 1}</span><span class="toc-title">${
        esc(c.title)
      }</span><span class="toc-dots"></span></a></li>`
    ).join("\n")
  }
</ol></nav>`;

  const chapters = book.chapters.map((c, i) =>
    `<section class="chapter" id="chapitre-${i + 1}">
  <p class="chapter-number">${template === "modern" ? String(i + 1).padStart(2, "0") : `${labels.chapter} ${i + 1}`}</p>
  <h1>${esc(c.title)}</h1>
  <div class="chapter-body">
${markupToHtml(c.content ?? "")}
  </div>
</section>`
  ).join("\n");

  const end = `<section class="end-page">
  <p class="thanks">${labels.thanks}</p>
  <p class="colophon">${esc(book.title)}</p>
  <p class="colophon">© ${year} ${esc(book.author)}. ${labels.rights}</p>
</section>`;

  const scripts = options.pagedScriptUrl
    ? `<script>${afterPaginationScript(options.autoPrint ?? false)}</script>
<script src="${options.pagedScriptUrl}"></script>`
    : "";

  return `<!doctype html>
<html lang="${book.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(book.title)}</title>
<style>${printStylesheet(template)}</style>
${scripts}
</head>
<body>
${cover}
${titlePage}
${toc}
${chapters}
${end}
</body>
</html>`;
}
