import { describe, expect, it } from "vitest";
import { legalEffectLabel, statusLabel } from "../status-labels";

describe("statusLabel", () => {
  it("humaniza estados de convocatoria y mantiene el limite demo registral", () => {
    expect(statusLabel("EMITIDA")).toBe("Emitida");
    expect(statusLabel("FILED")).toBe("Preparado para registro");
    // ITEM-102: PRESENTADA des-colisionada de SUBMITTED (vocabulario registral ES).
    expect(statusLabel("PRESENTADA")).toBe("Presentada");
    expect(statusLabel("ELEVADA")).toBe("Elevada a público");
  });

  it("traduce los estados del pipeline documental (informes/certificaciones)", () => {
    expect(statusLabel("EMITTED")).toBe("Emitida");
    expect(statusLabel("ARCHIVED")).toBe("Archivado");
    expect(statusLabel("SUPERSEDED")).toBe("Sustituido");
    expect(statusLabel("IN_REVIEW")).toBe("En revisión");
    expect(statusLabel("GENERATED")).toBe("Documento generado");
    expect(statusLabel("SOURCE_LOCKED")).toBe("Fuente fijada");
    expect(statusLabel("ATTACHED")).toBe("Anexado");
    expect(statusLabel("REVOKED")).toBe("Revocado");
    expect(statusLabel("FAILED")).toBe("Fallido");
    expect(statusLabel("WAIVED_WITH_OVERRIDE")).toBe("Omitido con autorización");
    expect(statusLabel("VERIFIED")).toBe("Verificada");
    // Estado desconocido: fallback al valor crudo (no rompe la UI).
    expect(statusLabel("NUEVO_ESTADO_X")).toBe("NUEVO_ESTADO_X");
  });
});

describe("legalEffectLabel", () => {
  it("nombra el efecto jurídico declarado de las certificaciones", () => {
    expect(legalEffectLabel("TERCERO")).toBe("Efecto frente a terceros");
    expect(legalEffectLabel("INTERNO")).toBe("Efecto interno");
    expect(legalEffectLabel("REGISTRAL")).toBe("Efecto registral");
    expect(legalEffectLabel(null)).toBe("Efecto no declarado");
    expect(legalEffectLabel("DESCONOCIDO")).toBe("DESCONOCIDO");
  });
});
