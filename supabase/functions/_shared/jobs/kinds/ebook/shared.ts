import type { ChapterRecord, EbookRecord } from "../../../ebook/types.ts";
import { JobError } from "../../errors.ts";
import type { JobContext } from "../../types.ts";

/** The ebook must belong to the job's user and project; anything else is refused and refunded. */
export async function loadOwnedEbook(ctx: JobContext, ebookId: string): Promise<EbookRecord> {
  const ebook = await ctx.data.ebooks.get(ebookId);
  if (!ebook || ebook.user_id !== ctx.userId || ebook.project_id !== ctx.projectId) {
    throw new JobError("invalid_input", false, "ebook not found for this user and project");
  }
  return ebook;
}

export function requireFields(ebook: EbookRecord, fields: (keyof EbookRecord)[]): void {
  const missing = fields.filter((field) => ebook[field] === null || ebook[field] === undefined);
  if (missing.length > 0) {
    throw new JobError("invalid_input", false, `ebook incomplete: ${missing.join(", ")}`);
  }
}

export function requireNotWritten(ebook: EbookRecord): void {
  if (ebook.bible) throw new JobError("invalid_input", false, "ebook writing already started");
}

export function isWritten(chapter: ChapterRecord): boolean {
  return chapter.status === "written" && !!chapter.content?.trim();
}

const STRUCTURAL = /^(#|>|-|\*|:::|\d+\.)/;

/** Indexes of the plain paragraphs of a chapter (not headings, lists, quotes or callouts). */
function plainParagraphs(blocks: string[]): number[] {
  const indexes: number[] = [];
  let inCallout = false;
  blocks.forEach((block, index) => {
    const text = block.trim();
    if (inCallout) {
      if (text === ":::" || text.endsWith("\n:::")) inCallout = false;
      return;
    }
    if (text.startsWith(":::")) {
      inCallout = !text.endsWith("\n:::");
      return;
    }
    if (!STRUCTURAL.test(text)) indexes.push(index);
  });
  return indexes;
}

export function splitBlocks(content: string): string[] {
  return content.split(/\n{2,}/).filter((block) => block.trim() !== "");
}

export function firstParagraph(content: string): string {
  const blocks = splitBlocks(content);
  const index = plainParagraphs(blocks)[0];
  return index === undefined ? "" : blocks[index].trim();
}

export function lastParagraph(content: string): string {
  const blocks = splitBlocks(content);
  const index = plainParagraphs(blocks).at(-1);
  return index === undefined ? "" : blocks[index].trim();
}

/** Replaces the opening and/or closing paragraph, leaving the rest of the chapter untouched. */
export function applyEdit(content: string, edit: { opening?: string; closing?: string }): string {
  const blocks = splitBlocks(content);
  const plain = plainParagraphs(blocks);
  if (plain.length === 0) return content;
  if (edit.opening) blocks[plain[0]] = edit.opening.trim();
  if (edit.closing && plain.length > 1) blocks[plain.at(-1)!] = edit.closing.trim();
  return blocks.join("\n\n");
}
