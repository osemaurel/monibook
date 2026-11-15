import { ebookChapterRewrite, ebookCover } from "./kinds/ebook/cover-and-rewrite.ts";
import { ebookOutline, ebookSummary, ebookTitles } from "./kinds/ebook/proposals.ts";
import { ebookWrite } from "./kinds/ebook/write.ts";
import { engineTest } from "./kinds/engine-test.ts";
import type { JobKindDefinition } from "./types.ts";

// A kind can only be launched if it is listed here AND priced in settings.credit_costs.
// deno-lint-ignore no-explicit-any
export const JOB_KINDS: Record<string, JobKindDefinition<any>> = {
  engine_test: engineTest,
  ebook_titles: ebookTitles,
  ebook_summary: ebookSummary,
  ebook_outline: ebookOutline,
  ebook_write_short: ebookWrite,
  ebook_write_standard: ebookWrite,
  ebook_write_complete: ebookWrite,
  ebook_cover: ebookCover,
  ebook_chapter_rewrite: ebookChapterRewrite,
};
