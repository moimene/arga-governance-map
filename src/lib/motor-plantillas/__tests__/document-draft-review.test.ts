import { describe, expect, it } from "vitest";
import {
  formatEditableDraftDiffSummary,
  summarizeEditableDraftDiff,
} from "../document-draft-review";

describe("document-draft-review", () => {
  it("resume diferencias entre borrador compuesto y cierre de secretaria", () => {
    const summary = summarizeEditableDraftDiff(
      ["ACTA", "ORDEN DEL DIA", "1. Informe"].join("\n"),
      ["ACTA", "ORDEN DEL DIA", "1. Informe revisado", "FIRMAS"].join("\n"),
    );

    expect(summary.changed).toBe(true);
    expect(summary.addedLines).toBe(2);
    expect(summary.removedLines).toBe(1);
    expect(formatEditableDraftDiffSummary(summary)).toContain("línea(s) añadida(s)");
    expect(summary.preview.join("\n")).toContain("Informe revisado");
  });

  it("detecta borrador sin cambios", () => {
    const summary = summarizeEditableDraftDiff("ACTA\nFIRMAS", "ACTA\nFIRMAS");

    expect(summary.changed).toBe(false);
    expect(formatEditableDraftDiffSummary(summary)).toBe("Sin cambios respecto del borrador compuesto.");
  });
});
