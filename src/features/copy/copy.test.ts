import { describe, expect, it } from "vitest";
import { benefitsError, benefitsToText, parseBenefits } from "@/features/projects/offer";
import { ALL_COPY_TYPES, COPY_TYPES, copyType, FREE_TYPE, hasPlaceholders, jobVariations } from "./config";

describe("project offer", () => {
  it("reads one benefit per line and drops list markers", () => {
    expect(parseBenefits("- Des repas en 15 minutes\n\n• Moins de 2 000 FCFA\n2) Des courses simples\n   ")).toEqual([
      "Des repas en 15 minutes",
      "Moins de 2 000 FCFA",
      "Des courses simples",
    ]);
    expect(benefitsToText(["A", "B"])).toBe("A\nB");
  });

  it("explains a list that is too long, in French", () => {
    expect(benefitsError("a\nb\nc\nd\ne\nf")).toBeNull();
    expect(benefitsError("a\nb\nc\nd\ne\nf\ng")).toBe("6 bénéfices au maximum.");
    expect(benefitsError("x".repeat(161))).toBe("Chaque bénéfice fait 160 caractères au maximum.");
  });
});

describe("copy types", () => {
  it("offers the seven predefined types first and free mode apart", () => {
    expect(COPY_TYPES.map((t) => t.id)).toEqual([
      "hooks",
      "facebook_short",
      "facebook_long",
      "sales_page",
      "email_sequence",
      "product_description",
      "social_captions",
    ]);
    expect(ALL_COPY_TYPES.at(-1)).toBe(FREE_TYPE);
    expect(copyType("sales_page")?.kind).toBe("copy_sales_page");
    expect(copyType("inconnu")).toBeUndefined();
  });

  it("reads the variations kept in a job's output and ignores anything malformed", () => {
    const output = {
      type: "hooks",
      variations: [
        { angle: "emotional", title: "Accroches · Émotionnel", content: "1. Une accroche" },
        { angle: "numbers", title: 3 },
        null,
      ],
    };
    expect(jobVariations(output)).toEqual([{ angle: "emotional", title: "Accroches · Émotionnel", content: "1. Une accroche" }]);
    expect(jobVariations(null)).toEqual([]);
  });

  it("spots the placeholders the author must fill in", () => {
    expect(hasPlaceholders("Comme [Prénom du client], vous gagnerez du temps.")).toBe(true);
    expect(hasPlaceholders("Offre valable jusqu'au [date limite].")).toBe(true);
    expect(hasPlaceholders("Aucun emplacement ici.")).toBe(false);
  });
});
