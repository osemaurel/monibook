import type { ComponentType } from "react";
import { useCreditCosts } from "@/features/credits/use-credits";
import { EbookTab } from "@/features/ebook/ebook-tab";
import { WRITE_KINDS } from "@/features/ebook/config";
import { EngineTestLauncher } from "./launchers/engine-test-launcher";
import { deliverableRequirement, type LaunchRequirement } from "./readiness";

export interface ProjectModule {
  id: string;
  tabLabel: string;
  jobKind: string;
  /** What the empty tab announces it will produce. */
  produces: string;
  /** Set when the deliverable is required before the project can be launched. */
  launchRequirement?: LaunchRequirement;
  /** Launch form shown in the generic tab. */
  Launcher?: ComponentType<{ module: ProjectModule }>;
  /** Whole tab content, for modules with their own flow. */
  Tab?: ComponentType<{ module: ProjectModule }>;
}

export const PROJECT_MODULES: ProjectModule[] = [
  {
    id: "ebook",
    tabLabel: "Ebook",
    jobKind: "ebook_titles",
    produces:
      "Un ebook complet en PDF : titre, résumé, plan, chapitres rédigés avec une bible commune, couverture et mise en page soignée.",
    launchRequirement: deliverableRequirement("l'ebook", WRITE_KINDS),
    Tab: EbookTab,
  },
  {
    id: "visuals",
    tabLabel: "Visuels",
    jobKind: "ad_visuals",
    produces: "Des visuels publicitaires prêts à publier, aux formats carré, story et bannière.",
    launchRequirement: deliverableRequirement("les visuels", "ad_visuals"),
  },
  {
    id: "videos",
    tabLabel: "Vidéos",
    jobKind: "ad_videos",
    produces: "Des vidéos publicitaires courtes au format vertical, avec voix off.",
  },
  {
    id: "texts",
    tabLabel: "Textes",
    jobKind: "sales_copy",
    produces: "Les textes de vente : page de vente, accroches publicitaires et descriptions du produit.",
    launchRequirement: deliverableRequirement("les textes de vente", "sales_copy"),
  },
  {
    id: "competition",
    tabLabel: "Concurrence",
    jobKind: "competitor_analysis",
    produces: "Une analyse des offres concurrentes sur votre niche : positionnement, prix et angles utilisés.",
  },
  {
    id: "engine-test",
    tabLabel: "Test du moteur",
    jobKind: "engine_test",
    produces: "Une génération de test de 30 secondes qui renvoie un texte, pour vérifier tout le cycle sans frais externes.",
    Launcher: EngineTestLauncher,
  },
];

/** A module appears only when it can really be launched: its screens are built and its price is set. */
export function useAvailableModules(): { modules: ProjectModule[]; loading: boolean } {
  const costs = useCreditCosts();
  const modules = PROJECT_MODULES.filter((m) => (m.Launcher || m.Tab) && costs.data?.[m.jobKind] !== undefined);
  return { modules, loading: costs.isPending };
}

export function useLaunchRequirements(): LaunchRequirement[] {
  return useAvailableModules().modules.flatMap((m) => (m.launchRequirement ? [m.launchRequirement] : []));
}
