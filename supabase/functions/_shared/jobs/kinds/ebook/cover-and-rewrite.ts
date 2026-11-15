import { COVER_PROPOSALS } from "../../../ebook/config.ts";
import { ChapterOutput, coverPrompt, rewritePrompt } from "../../../ebook/prompts.ts";
import { JobError } from "../../errors.ts";
import { ChapterRewriteInput, EbookInput } from "../../inputs.ts";
import { type AssetDraft, defineJobKind } from "../../types.ts";
import { isWritten, loadOwnedEbook, requireFields } from "./shared.ts";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Step 7: several cover artworks; the title is typeset over the chosen one. */
export const ebookCover = defineJobKind({
  input: EbookInput,
  async run({ ebook_id }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    requireFields(ebook, ["title"]);
    await ctx.progress(10, "Création des propositions de couverture");
    const { images } = await ctx.services.image.generate({
      prompt: coverPrompt(ebook),
      width: 1024,
      height: 1536,
      count: COVER_PROPOSALS,
    });

    await ctx.progress(80, "Enregistrement des couvertures");
    const assets: AssetDraft[] = [];
    for (const [index, image] of images.entries()) {
      const path = `${ctx.userId}/${ctx.projectId}/ebook/covers/${ctx.jobId}-${index + 1}.${
        EXTENSIONS[image.mimeType] ?? "bin"
      }`;
      const size = await ctx.data.files.upload(path, image);
      assets.push({
        kind: "image",
        title: `Proposition de couverture ${index + 1}`,
        storage_path: path,
        mime_type: image.mimeType,
        size_bytes: size,
      });
    }
    return { output: { covers: assets.map((a) => a.storage_path) }, assets };
  },
});

/** Step 8: rewrites a single chapter, with the bible and the rest of the book as context. */
export const ebookChapterRewrite = defineJobKind({
  input: ChapterRewriteInput,
  async run({ ebook_id, chapter_id, instructions }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    if (!ebook.bible) throw new JobError("invalid_input", false, "ebook not written yet");

    const chapters = await ctx.data.ebooks.listChapters(ebook.id);
    const index = chapters.findIndex((c) => c.id === chapter_id);
    if (index === -1) throw new JobError("invalid_input", false, "chapter not in this ebook");
    const chapter = chapters[index];

    await ctx.progress(10, `Relecture du contexte du chapitre ${index + 1}`);
    await ctx.data.ebooks.markChapterWriting(chapter.id);
    const others = chapters
      .map((c, i) => ({ number: i + 1, title: c.title, summary: c.summary ?? "", written: isWritten(c) }))
      .filter((c) => c.number !== index + 1 && c.written);

    await ctx.progress(30, `Rédaction du chapitre ${index + 1} : ${chapter.title}`);
    const result = await ctx.services.text.generateJson(
      rewritePrompt(ebook.bible, others, { number: index + 1, ...chapter }, chapters.length, instructions),
      ChapterOutput,
    );
    await ctx.data.ebooks.saveChapter(chapter.id, result.content, result.summary);
    return { output: { chapter_id: chapter.id } };
  },
});
