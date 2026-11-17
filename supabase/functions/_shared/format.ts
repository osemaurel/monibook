const NBSP = " ";
const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** 1500 -> "1 500" (non-breaking spaces, never decimals). */
export function formatInteger(value: number): string {
  return integerFormat.format(Math.trunc(value)).replace(/\s/g, NBSP);
}

/** 1500 -> "1 500 FCFA". */
export function formatFcfa(value: number): string {
  return `${formatInteger(value)}${NBSP}FCFA`;
}
