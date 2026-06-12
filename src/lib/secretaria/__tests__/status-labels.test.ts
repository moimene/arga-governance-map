import { describe, expect, it } from "vitest";
import { statusLabel } from "../status-labels";

describe("statusLabel", () => {
  it("humaniza estados de convocatoria y mantiene el limite demo registral", () => {
    expect(statusLabel("EMITIDA")).toBe("Emitida");
    expect(statusLabel("FILED")).toBe("Preparado para registro");
    // ITEM-102: PRESENTADA des-colisionada de SUBMITTED (vocabulario registral ES).
    expect(statusLabel("PRESENTADA")).toBe("Presentada");
    expect(statusLabel("ELEVADA")).toBe("Elevada a público");
  });
});
