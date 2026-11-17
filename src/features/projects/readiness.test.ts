import { describe, expect, it } from "vitest";
import type { Project } from "./project";
import { deliverableRequirement, describeMissing, missingForLaunch } from "./readiness";

const base: Project = {
  id: "p",
  user_id: "u",
  name: "Cuisine express",
  niche: "Cuisine rapide",
  angle: "15 minutes",
  audience: "Étudiants",
  promise: "Cuisinez sain",
  planned_price_fcfa: 1500,
  benefits: [],
  call_to_action: null,
  guarantee: null,
  language: "fr",
  status: "draft",
  cover_path: "u/p/cover/c.webp",
  created_at: "",
  updated_at: "",
  done_jobs_by_kind: {},
  active_jobs: 0,
};

describe("readiness", () => {
  it("is ready when every field is filled and no deliverable is required", () => {
    expect(missingForLaunch(base, [])).toEqual([]);
    expect(describeMissing([])).toBe("Prêt à être lancé");
  });

  it("lists missing fields in a French sentence", () => {
    const missing = missingForLaunch({ ...base, niche: null, cover_path: null, planned_price_fcfa: null }, []);
    expect(missing).toEqual(["la niche", "le prix envisagé", "la couverture"]);
    expect(describeMissing(missing)).toBe("Il manque la niche, le prix envisagé et la couverture.");
  });

  it("counts a free price (0 FCFA) as set", () => {
    expect(missingForLaunch({ ...base, planned_price_fcfa: 0 }, [])).toEqual([]);
  });

  it("requires a successful generation for each required deliverable", () => {
    const ebook = deliverableRequirement("l'ebook", "ebook");
    expect(missingForLaunch(base, [ebook])).toEqual(["l'ebook"]);
    expect(missingForLaunch({ ...base, done_jobs_by_kind: { ebook: 1 } }, [ebook])).toEqual([]);
  });
});
