import { markupToText } from "./markup";

export interface ExportableBook {
  title: string;
  subtitle: string | null;
  author: string;
  chapters: { title: string; content: string | null }[];
}

export function ebookToText(book: ExportableBook): string {
  const header = [book.title, book.subtitle, book.author].filter(Boolean).join("\n");
  const toc = ["SOMMAIRE", ...book.chapters.map((c, i) => `${i + 1}. ${c.title}`)].join("\n");
  const chapters = book.chapters.map((c, i) =>
    [`CHAPITRE ${i + 1}`, c.title.toUpperCase(), "", markupToText(c.content ?? "")].join("\n")
  );
  return [header, toc, ...chapters].join("\n\n\n") + "\n";
}

export function fileSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "ebook";
}

export function downloadText(filename: string, text: string): void {
  // The byte order mark keeps accents readable in older text editors.
  const blob = new Blob(["﻿", text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
