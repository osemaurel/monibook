import type { SupabaseClient } from "../deps.ts";
import type { ChapterRecord, EbookRecord, EbookStore, FileStore } from "./types.ts";

const EBOOK_COLUMNS =
  "id, user_id, project_id, subject, template, title, subtitle, summary, length, tone, instructions, author_name, bible, written_at";
const CHAPTER_COLUMNS = "id, ebook_id, position, title, brief, content, summary, status";

function check(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export function createSupabaseEbookStore(admin: SupabaseClient): EbookStore {
  async function update(ebookId: string, patch: Record<string, unknown>, action: string) {
    const { error } = await admin.from("ebooks").update(patch).eq("id", ebookId);
    check(error, action);
  }

  async function updateChapter(chapterId: string, patch: Record<string, unknown>, action: string) {
    const { error } = await admin.from("ebook_chapters").update(patch).eq("id", chapterId);
    check(error, action);
  }

  return {
    async get(ebookId) {
      const { data: ebook, error } = await admin.from("ebooks").select(EBOOK_COLUMNS).eq("id", ebookId)
        .maybeSingle();
      check(error, "read ebook");
      if (!ebook) return null;
      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("name, niche, angle, audience, promise, language")
        .eq("id", ebook.project_id)
        .single();
      check(projectError, "read project");
      return { ...ebook, project } as EbookRecord;
    },
    setTitleProposals: (ebookId, titles) => update(ebookId, { title_proposals: titles }, "save titles"),
    setSummary: (ebookId, summary) => update(ebookId, { summary }, "save summary"),
    async replaceOutline(ebook, chapters) {
      const { error: deleteError } = await admin.from("ebook_chapters").delete().eq("ebook_id", ebook.id);
      check(deleteError, "clear outline");
      const { error } = await admin.from("ebook_chapters").insert(
        chapters.map((chapter, index) => ({
          ebook_id: ebook.id,
          user_id: ebook.user_id,
          position: index + 1,
          title: chapter.title,
          brief: chapter.brief,
        })),
      );
      check(error, "save outline");
    },
    setBible: (ebookId, bible) => update(ebookId, { bible }, "save bible"),
    async listChapters(ebookId) {
      const { data, error } = await admin
        .from("ebook_chapters")
        .select(CHAPTER_COLUMNS)
        .eq("ebook_id", ebookId)
        .order("position");
      check(error, "list chapters");
      return (data ?? []) as ChapterRecord[];
    },
    markChapterWriting: (chapterId) => updateChapter(chapterId, { status: "writing" }, "mark chapter"),
    saveChapter: (chapterId, content, summary) =>
      updateChapter(chapterId, { content, summary, status: "written" }, "save chapter"),
    finishWriting: (ebookId, coherenceNotes) =>
      update(
        ebookId,
        { coherence_notes: coherenceNotes, written_at: new Date().toISOString() },
        "finish writing",
      ),
  };
}

export function createSupabaseFileStore(admin: SupabaseClient): FileStore {
  return {
    async upload(path, file) {
      const { error } = await admin.storage.from("assets").upload(path, file.data, {
        contentType: file.mimeType,
        upsert: true,
      });
      check(error, "upload file");
      return file.data.byteLength;
    },
  };
}
