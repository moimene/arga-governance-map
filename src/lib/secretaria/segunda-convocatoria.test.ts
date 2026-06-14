import { describe, it, expect } from "vitest";
import {
  gapSegundaConvocatoriaHoras,
  segundaConvocatoriaGapIncumplido,
} from "./segunda-convocatoria";

// ITEM-034 — art. 177.2 LSC: entre 1ª y 2ª convocatoria de junta debe mediar
// al menos 24 horas. El incumplimiento debe ser bloqueante, no solo advertencia.
describe("segunda-convocatoria (art. 177.2 LSC)", () => {
  it("gap < 24h → incumplido", () => {
    expect(segundaConvocatoriaGapIncumplido("2026-06-01", "10:00", "2026-06-02", "09:00")).toBe(true);
  });

  it("gap exactamente 24h → cumplido", () => {
    expect(segundaConvocatoriaGapIncumplido("2026-06-01", "10:00", "2026-06-02", "10:00")).toBe(false);
  });

  it("gap > 24h → cumplido", () => {
    expect(segundaConvocatoriaGapIncumplido("2026-06-01", "10:00", "2026-06-03", "10:00")).toBe(false);
  });

  it("mismo día, pocas horas → incumplido", () => {
    expect(segundaConvocatoriaGapIncumplido("2026-06-01", "10:00", "2026-06-01", "12:00")).toBe(true);
  });

  it("fechas inválidas o faltantes → no incumplido (no se puede evaluar)", () => {
    expect(segundaConvocatoriaGapIncumplido("", "10:00", "2026-06-02", "10:00")).toBe(false);
    expect(segundaConvocatoriaGapIncumplido("no-fecha", "10:00", "x", "10:00")).toBe(false);
  });

  it("gapSegundaConvocatoriaHoras calcula horas correctas", () => {
    expect(gapSegundaConvocatoriaHoras("2026-06-01", "10:00", "2026-06-02", "10:00")).toBe(24);
    expect(gapSegundaConvocatoriaHoras("", "10:00", "2026-06-02", "10:00")).toBeNull();
  });
});
