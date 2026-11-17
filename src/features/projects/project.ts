import type { Enums, Tables } from "@/lib/database.types";

export type ProjectStatus = Enums<"project_status">;
export type ProjectLanguage = "fr" | "en";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  angle: string | null;
  audience: string | null;
  promise: string | null;
  planned_price_fcfa: number | null;
  /** The offer, shared by every module: up to 6 benefits, a call to action, a guarantee. */
  benefits: string[];
  call_to_action: string | null;
  guarantee: string | null;
  language: ProjectLanguage;
  status: ProjectStatus;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  /** Number of successful generations per job kind, from rows written in the database. */
  done_jobs_by_kind: Record<string, number>;
  active_jobs: number;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Brouillon",
  in_progress: "En cours",
  launched: "Lancé",
  archived: "Archivé",
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];

export const LANGUAGE_LABELS: Record<ProjectLanguage, string> = {
  fr: "Français",
  en: "Anglais",
};

export const PROJECT_OVERVIEW_COLUMNS =
  "id, user_id, name, niche, angle, audience, promise, planned_price_fcfa, benefits, call_to_action, guarantee, language, status, cover_path, created_at, updated_at, done_jobs_by_kind, active_jobs";

export function toProject(row: Tables<"project_overview">): Project {
  if (!row.id || !row.user_id || !row.name || !row.status) throw new Error("Projet incomplet");
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    niche: row.niche,
    angle: row.angle,
    audience: row.audience,
    promise: row.promise,
    planned_price_fcfa: row.planned_price_fcfa,
    benefits: row.benefits ?? [],
    call_to_action: row.call_to_action,
    guarantee: row.guarantee,
    language: row.language === "en" ? "en" : "fr",
    status: row.status,
    cover_path: row.cover_path,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    done_jobs_by_kind: (row.done_jobs_by_kind ?? {}) as Record<string, number>,
    active_jobs: row.active_jobs ?? 0,
  };
}
