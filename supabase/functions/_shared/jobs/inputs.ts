import { z } from "../deps.ts";
import { VISUAL_FORMAT_IDS, VISUAL_STYLE_IDS } from "../visuals/config.ts";

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

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Texts of the batch come from the project (pre-filled in the form); the server re-reads the rest. */
export const AdVisualsInput = z.strictObject({
  format: z.enum(VISUAL_FORMAT_IDS),
  style: z.enum(VISUAL_STYLE_IDS),
  headline: trimmed(90),
  promise: trimmed(300).optional(),
  price_fcfa: z.number().int().min(0).max(100_000_000).optional(),
  benefits: z.array(trimmed(160)).max(6).default([]),
  call_to_action: trimmed(80),
  guarantee: trimmed(200).optional(),
  /** Optional style reference uploaded by the owner; the executor checks it is in this project. */
  reference_path: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/visuals\/references\/[A-Za-z0-9_-]{1,80}\.(webp|jpg|jpeg|png)$/)
    .optional(),
});

export const CopyInput = z.strictObject({ instructions: trimmed(1000).optional() });
export const CopyFreeInput = z.strictObject({ request: z.string().trim().min(10).max(2000) });

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
  ad_visuals: AdVisualsInput,
  copy_hooks: CopyInput,
  copy_facebook_short: CopyInput,
  copy_facebook_long: CopyInput,
  copy_sales_page: CopyInput,
  copy_email_sequence: CopyInput,
  copy_product_description: CopyInput,
  copy_social_captions: CopyInput,
  copy_free: CopyFreeInput,
};
