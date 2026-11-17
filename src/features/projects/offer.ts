// The offer of a project (benefits, call to action, guarantee), shared by the project form and the
// modules that reuse it. Kept free of zod: it is imported by light screens too.

export const MAX_BENEFITS = 6;
export const BENEFIT_MAX_LENGTH = 160;
export const CALL_TO_ACTION_MAX_LENGTH = 80;
export const GUARANTEE_MAX_LENGTH = 200;

/** One benefit per line; list markers typed by habit ("-", "•", "*", "1.") are removed. */
export function parseBenefits(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter((line) => line !== "");
}

export function benefitsToText(benefits: string[]): string {
  return benefits.join("\n");
}

/** French error for a list of benefits typed one per line, or null when it is valid. */
export function benefitsError(text: string): string | null {
  const benefits = parseBenefits(text);
  if (benefits.length > MAX_BENEFITS) return `${MAX_BENEFITS} bénéfices au maximum.`;
  if (benefits.some((b) => b.length > BENEFIT_MAX_LENGTH)) {
    return `Chaque bénéfice fait ${BENEFIT_MAX_LENGTH} caractères au maximum.`;
  }
  return null;
}
