import { describe, expect, it } from "vitest";
import { statusLabel } from "../status-labels";

describe("statusLabel", () => {
  it("humaniza estados de convocatoria y mantiene el limite demo registral", () => {
    expect(statusLabel("EMITIDA")).toBe("Emitida");
    expect(statusLabel("FILED")).toBe("Preparado para registro");
  });
});
