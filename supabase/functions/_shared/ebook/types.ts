import type { BinaryFile } from "../services/types.ts";
import type { EbookLength, EbookTemplate } from "./config.ts";

export interface ProjectBrief {
  name: string;
  niche: string | null;
  angle: string | null;
  audience: string | null;
  promise: string | null;
  language: "fr" | "en";
}

export interface EbookBible {
  title: string;
  subtitle: string | null;
  author: string;
  language: "fr" | "en";
  template: EbookTemplate;
  length: EbookLength;
  promise: string;
  audience: string;
  tone: string;
  instructions: string | null;
  summary: string;
  audience_profile: string;
  voice_guidelines: string;
  key_messages: string[];
  terminology: { term: string; definition: string }[];
  rules: string[];
  outline: { number: number; title: string; brief: string }[];
}

export interface EbookRecord {
  id: string;
  user_id: string;
  project_id: string;
  subject: string | null;
  template: EbookTemplate | null;
  title: string | null;
  subtitle: string | null;
  summary: string | null;
  length: EbookLength | null;
  tone: string | null;
  instructions: string | null;
  author_name: string | null;
  bible: EbookBible | null;
  written_at: string | null;
  project: ProjectBrief;
}

export interface ChapterRecord {
  id: string;
  ebook_id: string;
  position: number;
  title: string;
  brief: string | null;
  content: string | null;
  summary: string | null;
  status: "pending" | "writing" | "written";
}

export interface EbookStore {
  get(ebookId: string): Promise<EbookRecord | null>;
  setTitleProposals(ebookId: string, titles: string[]): Promise<void>;
  setSummary(ebookId: string, summary: string): Promise<void>;
  replaceOutline(ebook: EbookRecord, chapters: { title: string; brief: string }[]): Promise<void>;
  setBible(ebookId: string, bible: EbookBible): Promise<void>;
  /** Ordered by position. */
  listChapters(ebookId: string): Promise<ChapterRecord[]>;
  markChapterWriting(chapterId: string): Promise<void>;
  saveChapter(chapterId: string, content: string, summary: string): Promise<void>;
  finishWriting(ebookId: string, coherenceNotes: string): Promise<void>;
}

export interface FileStore {
  /** Stores a generated file in the project's storage and returns its size in bytes. */
  upload(path: string, file: BinaryFile): Promise<number>;
}
