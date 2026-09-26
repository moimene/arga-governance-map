import { describe, expect, it } from "vitest";
import { resolveNoSessionTotalDestinatarios } from "../useAgreementCompliance";

// MOI-208: con total_members nulo (no se sabe cuántos miembros tiene el
// órgano) el hook NO debe fabricar un denominador sintético a partir de los
// votos emitidos. Antes: Math.max(0, votos, 1) → con un solo voto, el total
// de destinatarios era 1, y una sola constancia bastaba para dar la
// notificación por completa.
describe("resolveNoSessionTotalDestinatarios", () => {
  it("total_members nulo → null (no medido), sin denominador sintético", () => {
    expect(resolveNoSessionTotalDestinatarios(null, 1, 0, 0)).toBeNull();
    expect(resolveNoSessionTotalDestinatarios(undefined, 0, 0, 0)).toBeNull();
  });

  it("total_members presente se respeta, con suelo en los votos emitidos", () => {
    expect(resolveNoSessionTotalDestinatarios(5, 2, 1, 0)).toBe(5);
    // Dato inconsistente (menos miembros que votos computados): el total no
    // puede ser inferior a los votos ya emitidos.
    expect(resolveNoSessionTotalDestinatarios(2, 2, 1, 0)).toBe(3);
  });
});
