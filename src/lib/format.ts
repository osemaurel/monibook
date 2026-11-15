const NBSP = " ";

const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** 1500 -> "1 500" (non-breaking spaces, never decimals). */
export function formatInteger(value: number): string {
  return integerFormat.format(Math.trunc(value)).replace(/[  \s]/g, NBSP);
}

/** 1500 -> "1 500 FCFA". */
export function formatFcfa(value: number): string {
  return `${formatInteger(value)}${NBSP}FCFA`;
}

/** 0 -> "0 crédit", 1 -> "1 crédit", 5 -> "5 crédits". */
export function formatCredits(value: number): string {
  return `${formatInteger(value)}${NBSP}${Math.abs(value) >= 2 ? "crédits" : "crédit"}`;
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
