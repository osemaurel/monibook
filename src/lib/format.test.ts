import { describe, expect, it } from "vitest";
import { formatCredits, formatFcfa, formatInteger } from "./format";

const NBSP = " ";

describe("format", () => {
  it("formats FCFA prices without decimals, with spaced thousands", () => {
    expect(formatFcfa(1500)).toBe(`1${NBSP}500${NBSP}FCFA`);
    expect(formatFcfa(250000)).toBe(`250${NBSP}000${NBSP}FCFA`);
    expect(formatFcfa(1500.7)).toBe(`1${NBSP}500${NBSP}FCFA`);
    expect(formatFcfa(0)).toBe(`0${NBSP}FCFA`);
  });

  it("pluralizes credits the French way", () => {
    expect(formatCredits(0)).toBe(`0${NBSP}crédit`);
    expect(formatCredits(1)).toBe(`1${NBSP}crédit`);
    expect(formatCredits(5)).toBe(`5${NBSP}crédits`);
    expect(formatCredits(-5)).toBe(`-5${NBSP}crédits`);
    expect(formatCredits(12000)).toBe(`12${NBSP}000${NBSP}crédits`);
  });

  it("never outputs a decimal separator", () => {
    expect(formatInteger(1234567.89)).not.toMatch(/,/);
  });
});
