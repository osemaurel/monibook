// The chapter text format shared by the writer, the editor, the PDF and the text export:
// "## " / "### " headings, "- " and "1. " lists, "> " quotes (author after " — "),
// ":::encadre Title" ... ":::" callouts, **bold** and *italic*.

export type Block =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title: string; blocks: Block[] };

const CALLOUT_START = /^:::\s*encadr[eé]\s*(.*)$/i;
const CALLOUT_END = /^:::\s*$/;
const HEADING = /^(#{1,3})\s+(.+)$/;
const QUOTE = /^>\s?(.*)$/;
const BULLET = /^[-*•]\s+(.+)$/;
const NUMBERED = /^\d+[.)]\s+(.+)$/;

function isStructural(line: string): boolean {
  return [CALLOUT_START, HEADING, QUOTE, BULLET, NUMBERED].some((re) => re.test(line));
}

export function parseMarkup(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") {
      i++;
      continue;
    }

    const callout = line.match(CALLOUT_START);
    if (callout) {
      const inner: string[] = [];
      i++;
      while (i < lines.length && !CALLOUT_END.test(lines[i].trim())) inner.push(lines[i++]);
      i++;
      blocks.push({ type: "callout", title: callout[1].trim(), blocks: parseMarkup(inner.join("\n")) });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length === 3 ? 3 : 2, text: heading[2].trim() });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i].trim())) parts.push(lines[i++].trim().match(QUOTE)![1]);
      const text = parts.join(" ").trim();
      const split = text.lastIndexOf(" — ");
      blocks.push(
        split > 0
          ? { type: "quote", text: text.slice(0, split).trim(), cite: text.slice(split + 3).trim() }
          : { type: "quote", text },
      );
      continue;
    }

    const ordered = NUMBERED.test(line);
    if (ordered || BULLET.test(line)) {
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i].trim())) items.push(lines[i++].trim().match(pattern)![1]);
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isStructural(lines[i].trim())) {
      paragraph.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function inlineHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return `<h${block.level}>${inlineHtml(block.text)}</h${block.level}>`;
      case "paragraph":
        return `<p>${inlineHtml(block.text)}</p>`;
      case "list": {
        const tag = block.ordered ? "ol" : "ul";
        return `<${tag}>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</${tag}>`;
      }
      case "quote":
        return `<blockquote><p>${inlineHtml(block.text)}</p>${
          block.cite ? `<footer>${inlineHtml(block.cite)}</footer>` : ""
        }</blockquote>`;
      case "callout":
        return `<aside class="callout">${
          block.title ? `<p class="callout-title">${inlineHtml(block.title)}</p>` : ""
        }${blocksToHtml(block.blocks)}</aside>`;
    }
  }).join("\n");
}

export function markupToHtml(source: string): string {
  return blocksToHtml(parseMarkup(source));
}

function plainInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return plainInline(block.text);
      case "paragraph":
        return plainInline(block.text);
      case "list":
        return block.items.map((item, i) => `${block.ordered ? `${i + 1}.` : "-"} ${plainInline(item)}`).join("\n");
      case "quote":
        return `« ${plainInline(block.text)} »${block.cite ? ` — ${plainInline(block.cite)}` : ""}`;
      case "callout":
        return [block.title ? `[ ${plainInline(block.title)} ]` : "[ Encadré ]", blocksToText(block.blocks)].join("\n");
    }
  }).join("\n\n");
}

export function markupToText(source: string): string {
  return blocksToText(parseMarkup(source));
}
