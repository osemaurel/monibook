import { WRITE_KIND_BY_LENGTH } from "../../../ebook/config.ts";
import {
  BibleOutput,
  biblePrompt,
  buildBible,
  ChapterOutput,
  chapterPrompt,
  CoherenceOutput,
  coherencePrompt,
  type WrittenChapter,
} from "../../../ebook/prompts.ts";
import { JobError } from "../../errors.ts";
import { EbookInput } from "../../inputs.ts";
import { defineJobKind } from "../../types.ts";
import {
  applyEdit,
  firstParagraph,
  isWritten,
  lastParagraph,
  loadOwnedEbook,
  requireFields,
} from "./shared.ts";

/**
 * A new chapter is only started before this point, so that it finishes within the platform's
 * time limit for one worker invocation. Past it, the job hands over and the next invocation
 * resumes at the first unwritten chapter.
 */
export const WRITE_BUDGET_MS = 70_000;

/**
 * Step 6: builds the bible, writes the chapters one by one (each saved as soon as it is written,
 * with the bible and the summaries of the previous chapters in every call), then runs a coherence
 * pass over the whole book. Safe to resume after a hand-over, a retry or a crash.
 */
export const ebookWrite = defineJobKind({
  input: EbookInput,
  async run({ ebook_id }, ctx) {
    const ebook = await loadOwnedEbook(ctx, ebook_id);
    requireFields(ebook, ["subject", "template", "title", "summary", "length", "tone", "author_name"]);
    if (ctx.kind !== WRITE_KIND_BY_LENGTH[ebook.length!]) {
      throw new JobError("invalid_input", false, `${ctx.kind} does not match length ${ebook.length}`);
    }

    const store = ctx.data.ebooks;
    const chapters = await store.listChapters(ebook.id);
    if (chapters.length === 0) throw new JobError("invalid_input", false, "ebook has no outline");
    const total = chapters.length;

    let bible = ebook.bible;
    if (!bible) {
      await ctx.progress(2, "Préparation de la bible du livre");
      const generated = await ctx.services.text.generateJson(biblePrompt(ebook, chapters), BibleOutput);
      bible = buildBible(ebook, chapters, generated);
      await store.setBible(ebook.id, bible);
    }

    for (const [index, chapter] of chapters.entries()) {
      if (isWritten(chapter)) continue;
      if (ctx.elapsedMs() > WRITE_BUDGET_MS) return { continueLater: true };

      const done = chapters.filter(isWritten).length;
      await ctx.progress(
        5 + Math.round((done / total) * 85),
        `Chapitre ${index + 1} sur ${total} : ${chapter.title}`,
      );
      await store.markChapterWriting(chapter.id);

      const previous: WrittenChapter[] = chapters.slice(0, index).filter(isWritten).map((c) => ({
        number: chapters.indexOf(c) + 1,
        title: c.title,
        summary: c.summary ?? "",
      }));
      const result = await ctx.services.text.generateJson(
        chapterPrompt(
          bible,
          previous,
          { number: index + 1, title: chapter.title, brief: chapter.brief },
          total,
          chapters[index + 1],
        ),
        ChapterOutput,
      );
      await store.saveChapter(chapter.id, result.content, result.summary);
      Object.assign(chapter, { content: result.content, summary: result.summary, status: "written" });
    }

    if (!ebook.written_at) {
      await ctx.progress(92, "Passe de cohérence sur l'ensemble du livre");
      const review = await ctx.services.text.generateJson(
        coherencePrompt(
          bible,
          chapters.map((c, i) => ({
            number: i + 1,
            title: c.title,
            summary: c.summary ?? "",
            opening: firstParagraph(c.content!),
            closing: lastParagraph(c.content!),
          })),
        ),
        CoherenceOutput,
      );
      for (const edit of review.edits) {
        const chapter = chapters[edit.number - 1];
        if (!chapter?.content) continue;
        const revised = applyEdit(chapter.content, edit);
        if (revised !== chapter.content) {
          await store.saveChapter(chapter.id, revised, chapter.summary ?? "");
          chapter.content = revised;
        }
      }
      await store.finishWriting(ebook.id, review.notes);
    }

    const words = chapters.reduce((sum, c) => sum + (c.content?.trim().split(/\s+/).length ?? 0), 0);
    return { output: { chapters: total, words } };
  },
});
