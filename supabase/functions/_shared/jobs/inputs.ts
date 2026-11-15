import { z } from "../deps.ts";

// Input schemas of every job kind, kept apart from the executors so job-create stays small.

export const EngineTestInput = z.object({
  topic: z.string().trim().min(1).max(200),
  simulate_failure: z.enum(["none", "first_attempt", "always"]).default("none"),
});

export const EbookInput = z.strictObject({ ebook_id: z.uuid() });

export const ChapterRewriteInput = z.strictObject({
  ebook_id: z.uuid(),
  chapter_id: z.uuid(),
  instructions: z.string().trim().min(1).max(1000).optional(),
});

export const JOB_INPUTS: Record<string, z.ZodType> = {
  engine_test: EngineTestInput,
  ebook_titles: EbookInput,
  ebook_summary: EbookInput,
  ebook_outline: EbookInput,
  ebook_write_short: EbookInput,
  ebook_write_standard: EbookInput,
  ebook_write_complete: EbookInput,
  ebook_cover: EbookInput,
  ebook_chapter_rewrite: ChapterRewriteInput,
};
