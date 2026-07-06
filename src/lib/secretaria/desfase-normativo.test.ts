import { describe, it, expect } from "vitest";
import { evaluarDesfaseNormativo } from "./desfase-normativo";

// T11 — el aviso de desfase solo se emite con hash congelado CANÓNICO y distinto
// del vivo; nunca para hashes de origen reunión (payload) → sin falsos positivos.
describe("evaluarDesfaseNormativo (T11)", () => {
  it("canónico + distinto del vivo → desfase con mensaje", () => {
    const r = evaluarDesfaseNormativo({ frozenProfileHash: "abc", frozenProfileHashKind: "CANONICAL", liveProfileHash: "xyz" });
    expect(r.comparable).toBe(true);
    expect(r.desfase).toBe(true);
    expect(r.mensaje).toMatch(/marco normativo/i);
  });

  it("canónico + igual al vivo → sin desfase", () => {
    const r = evaluarDesfaseNormativo({ frozenProfileHash: "abc", frozenProfileHashKind: "CANONICAL", liveProfileHash: "abc" });
    expect(r.comparable).toBe(true);
    expect(r.desfase).toBe(false);
    expect(r.mensaje).toBeNull();
  });

  it("kind PAYLOAD (origen reunión) → NO comparable, sin aviso (evita falso positivo)", () => {
    const r = evaluarDesfaseNormativo({ frozenProfileHash: "payload-123", frozenProfileHashKind: "PAYLOAD", liveProfileHash: "xyz" });
    expect(r.comparable).toBe(false);
    expect(r.desfase).toBe(false);
    expect(r.mensaje).toBeNull();
  });

  it("sin hash congelado o sin vivo → no comparable", () => {
    expect(evaluarDesfaseNormativo({ frozenProfileHash: null, frozenProfileHashKind: "CANONICAL", liveProfileHash: "xyz" }).comparable).toBe(false);
    expect(evaluarDesfaseNormativo({ frozenProfileHash: "abc", frozenProfileHashKind: "CANONICAL", liveProfileHash: null }).comparable).toBe(false);
  });

  it("kind desconocido → no comparable", () => {
    expect(evaluarDesfaseNormativo({ frozenProfileHash: "abc", frozenProfileHashKind: undefined, liveProfileHash: "xyz" }).comparable).toBe(false);
  });
});
