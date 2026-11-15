import type { ExportTemplate } from "../config";

// Print stylesheets (CSS Paged Media, paginated by Paged.js). A5 pages; fonts are system fonts
// so the PDF needs no download.

const SERIF = 'Georgia, "Times New Roman", "Liberation Serif", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Liberation Sans", sans-serif';

const NO_MARGIN_BOXES = `
  @top-left { content: none; } @top-center { content: none; } @top-right { content: none; }
  @bottom-left { content: none; } @bottom-center { content: none; } @bottom-right { content: none; }`;

const BASE = `
@page { size: 148mm 210mm; margin: 20mm 16mm 22mm 16mm; }
@page cover { margin: 0; ${NO_MARGIN_BOXES} }
@page front { ${NO_MARGIN_BOXES} }
@page end { ${NO_MARGIN_BOXES} }
@page chapter:first { @top-left { content: none; } @top-center { content: none; } @top-right { content: none; } }

html { font-size: 10.5pt; }
body { margin: 0; color: var(--ink); font-family: var(--body-font); line-height: 1.55; hyphens: auto; }
a { color: inherit; text-decoration: none; }

.cover { page: cover; position: relative; width: 148mm; height: 210mm; overflow: hidden;
  background: var(--cover-bg); color: #fff; break-after: page; }
.cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cover-text { position: absolute; left: 14mm; right: 14mm; top: 24mm; }
.cover h1 { font-family: var(--heading-font); font-size: 27pt; line-height: 1.1; margin: 0 0 4mm;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35); }
.cover .subtitle { font-size: 12pt; margin: 0; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35); }
.cover .author { position: absolute; left: 14mm; right: 14mm; bottom: 18mm; font-size: 11pt;
  letter-spacing: 0.08em; text-transform: uppercase; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35); }

.title-page { page: front; break-after: page; text-align: center; padding-top: 45mm; }
.title-page h1 { font-family: var(--heading-font); font-size: 22pt; line-height: 1.15; margin: 0 0 5mm; }
.title-page .subtitle { font-size: 12pt; color: var(--muted); margin: 0 0 22mm; }
.title-page .author { font-size: 11pt; letter-spacing: 0.06em; }

.toc { page: front; break-after: page; }
.toc h2 { font-family: var(--heading-font); font-size: 16pt; margin: 0 0 8mm; }
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc a { display: flex; align-items: baseline; gap: 2mm; padding: 1.4mm 0; }
.toc .toc-number { min-width: 6mm; color: var(--accent); font-variant-numeric: tabular-nums; }
.toc .toc-dots { flex: 1; border-bottom: 1px dotted var(--rule); transform: translateY(-1mm); }
.toc a::after { content: target-counter(attr(href), page); min-width: 7mm; text-align: right;
  font-variant-numeric: tabular-nums; }

.chapter { page: chapter; break-before: page; }
.chapter-number { margin: 0 0 3mm; color: var(--accent); }
.chapter h1 { string-set: chapter-title content(text); font-family: var(--heading-font);
  font-size: 21pt; line-height: 1.15; margin: 0 0 9mm; }
.chapter h2 { font-family: var(--heading-font); font-size: 13.5pt; line-height: 1.25; margin: 7mm 0 2.5mm;
  break-after: avoid; }
.chapter h3 { font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2.6mm; orphans: 2; widows: 2; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin: 0 0 1mm; }
blockquote { margin: 5mm 0; padding: 2mm 0 2mm 6mm; border-left: 2px solid var(--accent); break-inside: avoid; }
blockquote p { font-style: italic; margin: 0; }
blockquote footer { font-size: 9pt; color: var(--muted); margin-top: 1.5mm; }
blockquote footer::before { content: "— "; }
.callout { margin: 5mm 0; padding: 4mm 5mm; background: var(--callout-bg); border-radius: 2mm; break-inside: avoid; }
.callout p:last-child, .callout ul:last-child, .callout ol:last-child { margin-bottom: 0; }
.callout-title { font-weight: 700; color: var(--accent); text-transform: uppercase; font-size: 8.5pt;
  letter-spacing: 0.08em; margin: 0 0 2mm; }

.end-page { page: end; break-before: page; text-align: center; padding-top: 62mm; }
.end-page .thanks { font-family: var(--heading-font); font-size: 15pt; margin: 0 0 6mm; }
.end-page .colophon { color: var(--muted); font-size: 9.5pt; margin: 0 0 1.5mm; }

@media screen {
  body { background: #d4d4d8; }
  .pagedjs_pages { padding: 12px 0 72px; }
  .pagedjs_page { background: #fff; margin: 0 auto 12px; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.18); }
  @media (max-width: 620px) { .pagedjs_pages { zoom: 0.6; } }
}
`;

const TEMPLATES: Record<ExportTemplate, string> = {
  classic: `
:root { --ink: #1c1917; --muted: #78716c; --accent: #7c2d12; --rule: #a8a29e; --callout-bg: #f5f0e8;
  --cover-bg: linear-gradient(160deg, #7c2d12, #1c1917); --body-font: ${SERIF}; --heading-font: ${SERIF}; }
@page chapter {
  @top-center { content: string(chapter-title); font-family: ${SERIF}; font-style: italic; font-size: 8.5pt; color: #78716c; }
  @bottom-center { content: counter(page); font-family: ${SERIF}; font-size: 9pt; }
}
p { text-align: justify; }
.chapter-number { text-align: center; font-variant: small-caps; letter-spacing: 0.12em; font-size: 10pt; }
.chapter h1 { text-align: center; font-weight: 400; }
.chapter-body > p:first-child::first-letter { float: left; font-size: 3.3em; line-height: 0.85;
  padding: 1mm 1.5mm 0 0; color: #7c2d12; }
.chapter h2 { font-weight: 400; font-variant: small-caps; letter-spacing: 0.03em; }
`,
  modern: `
:root { --ink: #111827; --muted: #6b7280; --accent: #0f766e; --rule: #9ca3af; --callout-bg: #ecfdf5;
  --cover-bg: linear-gradient(160deg, #0f766e, #042f2e); --body-font: ${SANS}; --heading-font: ${SANS}; }
html { font-size: 10pt; }
@page chapter {
  @top-left { content: string(chapter-title); font-family: ${SANS}; font-size: 7.5pt; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.08em; }
  @bottom-right { content: counter(page); font-family: ${SANS}; font-size: 8.5pt; font-weight: 700; color: #0f766e; }
}
.chapter-number { font-size: 30pt; font-weight: 800; line-height: 1; }
.chapter h1 { font-weight: 800; letter-spacing: -0.01em; }
.chapter h2 { font-weight: 700; color: #0f766e; }
.callout { border-left: 3px solid #0f766e; border-radius: 0 2mm 2mm 0; }
.cover h1 { font-weight: 800; letter-spacing: -0.01em; }
`,
  elegant: `
:root { --ink: #27272a; --muted: #71717a; --accent: #a16207; --rule: #d4d4d8; --callout-bg: #fafaf9;
  --cover-bg: linear-gradient(160deg, #3f3f46, #18181b); --body-font: ${SERIF}; --heading-font: ${SERIF}; }
@page { margin: 24mm 20mm 26mm 20mm; }
@page chapter {
  @top-right { content: string(chapter-title); font-family: ${SERIF}; font-style: italic; font-size: 8pt; color: #a1a1aa; }
  @bottom-center { content: "— " counter(page) " —"; font-family: ${SERIF}; font-size: 8.5pt; color: #71717a; }
}
.chapter-number { font-style: italic; font-size: 11pt; }
.chapter h1 { font-weight: 400; font-size: 23pt; padding-bottom: 5mm; border-bottom: 0.4pt solid #d4d4d8; }
.chapter h2 { font-weight: 400; font-style: italic; }
.callout { background: none; border-top: 0.4pt solid #a16207; border-bottom: 0.4pt solid #a16207; border-radius: 0;
  padding: 4mm 2mm; }
blockquote { border-left: none; text-align: center; padding: 2mm 8mm; }
.cover h1 { font-weight: 400; }
`,
};

export function printStylesheet(template: ExportTemplate): string {
  return BASE + TEMPLATES[template];
}
