import type { ChapterRecord, EbookRecord, EbookStore, FileStore } from "../_shared/ebook/types.ts";
import type { AssetDraft, DataAccess } from "../_shared/jobs/types.ts";
import type { JobError } from "../_shared/jobs/errors.ts";
import type { JobStore } from "../_shared/jobs/runner.ts";
import type { BinaryFile } from "../_shared/services/types.ts";

export const USER = "00000000-0000-4000-8000-00000000000a";
export const PROJECT = "00000000-0000-4000-8000-0000000000b1";
export const EBOOK = "00000000-0000-4000-8000-0000000000e1";

export function sampleEbook(overrides: Partial<EbookRecord> = {}): EbookRecord {
  return {
    id: EBOOK,
    user_id: USER,
    project_id: PROJECT,
    subject: "Cuisiner sain en 15 minutes",
    template: "method_guide",
    title: "Cuisiner vite et bien",
    subtitle: null,
    summary: "Un guide pratique pour les étudiants pressés.",
    length: "short",
    tone: "Chaleureux et pédagogique",
    instructions: null,
    author_name: "Awa Diallo",
    bible: null,
    written_at: null,
    project: {
      name: "Cuisine express",
      niche: "Cuisine rapide",
      angle: "15 minutes",
      audience: "Étudiants",
      promise: "Cuisinez sain chaque jour",
      language: "fr",
    },
    ...overrides,
  };
}

export function sampleChapters(count: number): ChapterRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000c${String(i + 1).padStart(4, "0")}`,
    ebook_id: EBOOK,
    position: i + 1,
    title: `Chapitre du plan ${i + 1}`,
    brief: `Ce que couvre le chapitre ${i + 1}.`,
    content: null,
    summary: null,
    status: "pending",
  }));
}

export interface MemoryEbookStore extends EbookStore {
  ebook: EbookRecord;
  chapters: ChapterRecord[];
  log: string[];
}

export function memoryEbookStore(ebook: EbookRecord, chapters: ChapterRecord[] = []): MemoryEbookStore {
  const state = { ebook, chapters, log: [] as string[] };
  const chapter = (id: string) => state.chapters.find((c) => c.id === id)!;
  const store: MemoryEbookStore = {
    get ebook() {
      return state.ebook;
    },
    get chapters() {
      return state.chapters;
    },
    log: state.log,
    get: (id) => Promise.resolve(id === state.ebook.id ? structuredClone(state.ebook) : null),
    setTitleProposals(_, titles) {
      state.log.push(`titles:${titles.length}`);
      return Promise.resolve();
    },
    setSummary(_, summary) {
      state.ebook.summary = summary;
      state.log.push("summary");
      return Promise.resolve();
    },
    replaceOutline(_, chapters) {
      state.chapters = chapters.map((c, i) => ({
        ...sampleChapters(i + 1)[i],
        title: c.title,
        brief: c.brief,
      }));
      state.log.push(`outline:${chapters.length}`);
      return Promise.resolve();
    },
    setBible(_, bible) {
      state.ebook.bible = bible;
      state.log.push("bible");
      return Promise.resolve();
    },
    listChapters: () => Promise.resolve(structuredClone(state.chapters)),
    markChapterWriting(id) {
      chapter(id).status = "writing";
      return Promise.resolve();
    },
    saveChapter(id, content, summary) {
      Object.assign(chapter(id), { content, summary, status: "written" });
      state.log.push(`chapter:${chapter(id).position}`);
      return Promise.resolve();
    },
    finishWriting(_, notes) {
      state.ebook.written_at = new Date().toISOString();
      state.log.push(`finished:${notes.length > 0}`);
      return Promise.resolve();
    },
  };
  return store;
}

export function memoryFiles(): FileStore & { files: Map<string, BinaryFile> } {
  const files = new Map<string, BinaryFile>();
  return {
    files,
    upload(path, file) {
      files.set(path, file);
      return Promise.resolve(file.data.byteLength);
    },
  };
}

export function dataAccess(
  ebooks: EbookStore = memoryEbookStore(sampleEbook()),
  files = memoryFiles(),
): DataAccess {
  return { ebooks, files };
}

export interface RecordedJob {
  progress: Array<[number, string]>;
  completed?: { output: Record<string, unknown>; assets: AssetDraft[] };
  failed?: { code: string; retryable: boolean; message: string };
  yielded: number;
}

export function fakeJobStore(): JobStore & { recorded: RecordedJob } {
  const recorded: RecordedJob = { progress: [], yielded: 0 };
  return {
    recorded,
    setProgress(_id, _attempt, percent, step) {
      recorded.progress.push([percent, step]);
      return Promise.resolve();
    },
    complete(_id, _attempt, output, assets) {
      recorded.completed = { output, assets };
      return Promise.resolve();
    },
    fail(_id, _attempt, error: JobError, message) {
      recorded.failed = { code: error.code, retryable: error.retryable, message };
      return Promise.resolve();
    },
    yieldJob() {
      recorded.yielded++;
      return Promise.resolve();
    },
  };
}
