import { describe, expect, it } from "vitest";
import {
  isDecisionAgendaItem,
  mergeAgendaKindSources,
  normalizeAgendaItemKind,
  type AgendaItemKind,
} from "../agenda-kind";

describe("normalizeAgendaItemKind", () => {
  it.each<[unknown, AgendaItemKind]>([
    ["DECISORIO", "DECISORIO"],
    ["decisorio", "DECISORIO"],
    ["INFORMATIVO", "INFORMATIVO"],
    ["informativo", "INFORMATIVO"],
    ["TOMA_DE_RAZON", "TOMA_DE_RAZON"],
    ["toma_de_razon", "TOMA_DE_RAZON"],
    ["DELIBERATIVO", "DELIBERATIVO"],
    ["  DELIBERATIVO  ", "DELIBERATIVO"],
    ["ACEPTACION_INFORME", "ACEPTACION_INFORME"],
    ["RUEGOS_PREGUNTAS", "RUEGOS_PREGUNTAS"],
    ["  DECISIVO ", "DELIBERATIVO"], // típo no reconocido → default conservador
    ["", "DELIBERATIVO"],
    [null, "DELIBERATIVO"],
    [undefined, "DELIBERATIVO"],
    [42, "DELIBERATIVO"],
    [{}, "DELIBERATIVO"],
  ])("normalize(%p) → %s", (input, expected) => {
    expect(normalizeAgendaItemKind(input)).toBe(expected);
  });
});

describe("isDecisionAgendaItem", () => {
  it("returns true only for DECISORIO", () => {
    expect(isDecisionAgendaItem("DECISORIO")).toBe(true);
    expect(isDecisionAgendaItem("DELIBERATIVO")).toBe(false);
    expect(isDecisionAgendaItem("INFORMATIVO")).toBe(false);
    expect(isDecisionAgendaItem("TOMA_DE_RAZON")).toBe(false);
    expect(isDecisionAgendaItem("ACEPTACION_INFORME")).toBe(false);
    expect(isDecisionAgendaItem("RUEGOS_PREGUNTAS")).toBe(false);
  });
});

describe("mergeAgendaKindSources", () => {
  it("autoritative: tabla wins over snapshot (drift detected)", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "INFORMATIVO",
    });
    expect(result.effective).toBe("DECISORIO");
    expect(result.snapshot).toBe("INFORMATIVO");
    expect(result.drift).toBe(true);
  });

  it("no drift if same value", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "DECISORIO",
    });
    expect(result.effective).toBe("DECISORIO");
    expect(result.snapshot).toBe("DECISORIO");
    expect(result.drift).toBe(false);
  });

  it("snapshot null/undefined: no drift detection possible", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DELIBERATIVO",
      fromConvocatoriaSnapshot: undefined,
    });
    expect(result.effective).toBe("DELIBERATIVO");
    expect(result.snapshot).toBeNull();
    expect(result.drift).toBe(false);
  });

  it("snapshot null explicit: no drift", () => {
    const result = mergeAgendaKindSources({
      fromTable: "INFORMATIVO",
      fromConvocatoriaSnapshot: null,
    });
    expect(result.snapshot).toBeNull();
    expect(result.drift).toBe(false);
  });

  it("fromTable null falls back to DELIBERATIVO conservador", () => {
    const result = mergeAgendaKindSources({
      fromTable: null,
      fromConvocatoriaSnapshot: "DECISORIO",
    });
    expect(result.effective).toBe("DELIBERATIVO");
    expect(result.snapshot).toBe("DECISORIO");
    expect(result.drift).toBe(true);
  });

  it("normalizes snapshot input that is lowercase or messy", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "  decisorio  ",
    });
    expect(result.effective).toBe("DECISORIO");
    expect(result.snapshot).toBe("DECISORIO");
    expect(result.drift).toBe(false);
  });

  it("unrecognized snapshot value normalizes to DELIBERATIVO default", () => {
    const result = mergeAgendaKindSources({
      fromTable: "DECISORIO",
      fromConvocatoriaSnapshot: "DECISIVO", // typo
    });
    expect(result.effective).toBe("DECISORIO");
    expect(result.snapshot).toBe("DELIBERATIVO");
    expect(result.drift).toBe(true);
  });
});
