import { describe, expect, it } from "vitest";
import { ebookToText, fileSlug } from "./export-text";
import { markupToHtml, markupToText, parseMarkup } from "./markup";
import { buildEbookHtml } from "./pdf/build-html";
import { printStylesheet } from "./pdf/templates";

const CHAPTER = `Une ouverture avec du **gras** et de l'*italique*.

## Les bases

- Premier point
- Second point

1. Étape une
2. Étape deux

> La méthode compte plus que la motivation. — Proverbe

:::encadre À retenir
Un conseil pratique.

- avec une liste
:::

### Pour aller plus loin
Une ligne
qui continue.`;

describe("chapter markup", () => {
  it("parses every block of the chapter format", () => {
    expect(parseMarkup(CHAPTER).map((b) => b.type)).toEqual([
      "paragraph",
      "heading",
      "list",
      "list",
      "quote",
      "callout",
      "heading",
      "paragraph",
    ]);
    const quote = parseMarkup(CHAPTER)[4];
    expect(quote).toEqual({ type: "quote", text: "La méthode compte plus que la motivation.", cite: "Proverbe" });
    const callout = parseMarkup(CHAPTER)[5];
    expect(callout.type === "callout" && callout.blocks.map((b) => b.type)).toEqual(["paragraph", "list"]);
  });

  it("renders HTML with escaped text, callouts and quotes", () => {
    const html = markupToHtml(CHAPTER + "\n\n<script>alert(1)</script>");
    expect(html).toContain("<strong>gras</strong>");
    expect(html).toContain("<em>italique</em>");
    expect(html).toContain('<aside class="callout"><p class="callout-title">À retenir</p>');
    expect(html).toContain("<blockquote><p>La méthode compte plus que la motivation.</p><footer>Proverbe</footer></blockquote>");
    expect(html).toContain("<ol><li>Étape une</li><li>Étape deux</li></ol>");
    expect(html).toContain("<p>Une ligne qui continue.</p>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("exports readable plain text", () => {
    const text = markupToText(CHAPTER);
    expect(text).toContain("Une ouverture avec du gras et de l'italique.");
    expect(text).toContain("- Premier point");
    expect(text).toContain("2. Étape deux");
    expect(text).toContain("« La méthode compte plus que la motivation. » — Proverbe");
    expect(text).toContain("[ À retenir ]");
    expect(text).not.toMatch(/\*\*|:::/);
  });
});

describe("text export", () => {
  it("contains the title page, the contents and every chapter", () => {
    const text = ebookToText({
      title: "Cuisiner vite et bien",
      subtitle: "En 15 minutes",
      author: "Awa Diallo",
      chapters: [{ title: "Les bases", content: CHAPTER }, { title: "Les recettes", content: null }],
    });
    expect(text.startsWith("Cuisiner vite et bien\nEn 15 minutes\nAwa Diallo")).toBe(true);
    expect(text).toContain("SOMMAIRE\n1. Les bases\n2. Les recettes");
    expect(text).toContain("CHAPITRE 2\nLES RECETTES");
  });

  it("builds safe file names", () => {
    expect(fileSlug("Cuisiner vite & bien : l'été !")).toBe("cuisiner-vite-bien-l-ete");
    expect(fileSlug("***")).toBe("ebook");
  });
});

describe("PDF document", () => {
  const book = {
    title: "Cuisiner vite et bien",
    subtitle: "En 15 minutes",
    author: "Awa Diallo",
    language: "fr" as const,
    coverDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    chapters: [{ title: "Les bases", content: CHAPTER }, { title: "Les recettes", content: "Texte." }],
  };

  it("has a cover, a title page, clickable contents, chapters and an end page", () => {
    const html = buildEbookHtml(book, "classic");
    expect(html).toContain('<section class="cover">');
    expect(html).toContain('<img src="data:image/svg+xml;base64,PHN2Zy8+"');
    expect(html).toContain('<section class="title-page">');
    expect(html).toContain('<a href="#chapitre-1">');
    expect(html).toContain('<section class="chapter" id="chapitre-2">');
    expect(html).toContain("Chapitre 2");
    expect(html).toContain('<section class="end-page">');
    expect(html).toContain("Merci de votre lecture.");
    expect(html).not.toMatch(/monibook/i);
  });

  it("styles running heads, page numbers and contents page numbers in every template", () => {
    for (const template of ["classic", "modern", "elegant"] as const) {
      const css = printStylesheet(template);
      expect(css).toContain("string-set: chapter-title");
      expect(css).toContain("string(chapter-title)");
      expect(css).toContain("counter(page)");
      expect(css).toContain("target-counter(attr(href), page)");
      expect(css).toContain(".callout");
      expect(css).toContain("blockquote");
    }
  });

  it("loads the pagination script and prints only when asked", () => {
    expect(buildEbookHtml(book, "modern")).not.toContain("<script");
    const html = buildEbookHtml(book, "modern", { pagedScriptUrl: "https://app.test/paged.js", autoPrint: true });
    expect(html).toContain('<script src="https://app.test/paged.js"></script>');
    expect(html).toContain("window.print()");
    expect(html).toContain('data-paged", "ready"');
  });

  it("uses English labels for an English book", () => {
    const html = buildEbookHtml({ ...book, language: "en" }, "elegant");
    expect(html).toContain("<h2>Contents</h2>");
    expect(html).toContain("Thank you for reading.");
  });
});
