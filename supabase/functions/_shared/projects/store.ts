import type { SupabaseClient } from "../deps.ts";
import type { ProjectContext, ProjectStore } from "./types.ts";

function check(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export function createSupabaseProjectStore(admin: SupabaseClient): ProjectStore {
  return {
    async getContext(projectId) {
      const { data: project, error } = await admin
        .from("projects")
        .select(
          "id, user_id, name, niche, angle, audience, promise, planned_price_fcfa, language, benefits, call_to_action, guarantee, cover_path",
        )
        .eq("id", projectId)
        .is("deleted_at", null)
        .maybeSingle();
      check(error, "read project");
      if (!project) return null;

      const { data: ebook, error: ebookError } = await admin
        .from("ebooks")
        .select("id, title, subtitle, author_name, summary, cover_path")
        .eq("project_id", projectId)
        .maybeSingle();
      check(ebookError, "read ebook");

      let chapterTitles: string[] = [];
      if (ebook) {
        const { data: chapters, error: chaptersError } = await admin
          .from("ebook_chapters")
          .select("title")
          .eq("ebook_id", ebook.id)
          .order("position");
        check(chaptersError, "read chapters");
        chapterTitles = (chapters ?? []).map((c: { title: string }) => c.title);
      }

      const context: ProjectContext = {
        id: project.id,
        userId: project.user_id,
        name: project.name,
        niche: project.niche,
        angle: project.angle,
        audience: project.audience,
        promise: project.promise,
        priceFcfa: project.planned_price_fcfa,
        language: project.language === "en" ? "en" : "fr",
        benefits: project.benefits ?? [],
        callToAction: project.call_to_action,
        guarantee: project.guarantee,
        coverPath: project.cover_path,
        product: ebook?.title
          ? {
            title: ebook.title,
            subtitle: ebook.subtitle,
            author: ebook.author_name,
            summary: ebook.summary,
            chapterTitles,
            coverPath: ebook.cover_path,
          }
          : null,
      };
      return context;
    },
  };
}
