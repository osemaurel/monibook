import {
  outlineOutput,
  outlinePrompt,
  SummaryOutput,
  summaryPrompt,
  TitlesOutput,
  titlesPrompt,
} from "../../../ebook/prompts.ts";
import { EbookInput } from "../../inputs.ts";
import { defineJobKind } from "../../types.ts";
import { loadOwnedEbook, requireFields, requireNotWritten } from "./shared.ts";

/** Step 2: five title proposals, shaped by the subject and the template. */
export const ebookTitles = defineJobKind({
  input: EbookInput,
  async run({ ebook_id }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    requireFields(ebook, ["subject", "template"]);
    await ctx.progress(20, "Recherche de titres");
    const { titles } = await ctx.services.text.generateJson(titlesPrompt(ebook), TitlesOutput);
    await ctx.data.ebooks.setTitleProposals(ebook.id, titles);
    return { output: { titles } };
  },
});

/** Step 3: a summary the user can edit before validating it. */
export const ebookSummary = defineJobKind({
  input: EbookInput,
  async run({ ebook_id }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    requireFields(ebook, ["subject", "template", "title"]);
    requireNotWritten(ebook);
    await ctx.progress(20, "Rédaction du résumé");
    const { summary } = await ctx.services.text.generateJson(summaryPrompt(ebook), SummaryOutput);
    await ctx.data.ebooks.setSummary(ebook.id, summary);
    return { output: { summary } };
  },
});

/** Step 5: the chapter plan, replacing any previous plan. */
export const ebookOutline = defineJobKind({
  input: EbookInput,
  async run({ ebook_id }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    requireFields(ebook, ["subject", "template", "title", "summary", "length", "tone"]);
    requireNotWritten(ebook);
    await ctx.progress(20, "Construction du plan");
    const { chapters } = await ctx.services.text.generateJson(
      outlinePrompt(ebook),
      outlineOutput(ebook.length!),
    );
    await ctx.data.ebooks.replaceOutline(ebook, chapters);
    return { output: { chapters: chapters.length } };
  },
});
