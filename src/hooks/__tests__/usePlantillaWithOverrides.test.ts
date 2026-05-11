// src/hooks/__tests__/usePlantillaWithOverrides.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { applyCapa3Overrides } from "../usePlantillaWithOverrides";

describe("applyCapa3Overrides — pure merge function", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns canonical capa3 when no overrides", () => {
    const canonical = [
      { campo: "nombre", obligatoriedad: "OBLIGATORIO", default: "x" },
      { campo: "fecha", obligatoriedad: "OPCIONAL" },
    ];
    const result = applyCapa3Overrides(canonical, []);
    expect(result).toEqual(canonical);
  });

  it("applies default_value_override on matching campo", () => {
    const canonical = [{ campo: "x", obligatoriedad: "OPCIONAL", default: "old" }];
    const overrides = [
      {
        campo: "x",
        default_value_override: "new",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "1.0.0",
      },
    ];
    const result = applyCapa3Overrides(canonical, overrides);
    expect(result[0].default).toBe("new");
  });

  it("applies opciones_override and obligatoriedad_override together", () => {
    const canonical = [{ campo: "y", obligatoriedad: "OPCIONAL", opciones: ["A", "B", "C"] }];
    const overrides = [
      {
        campo: "y",
        default_value_override: null,
        opciones_override: ["A", "B"],
        obligatoriedad_override: "OBLIGATORIO",
        compatible_with_canonical_version: "1.0.0",
      },
    ];
    const result = applyCapa3Overrides(canonical, overrides);
    expect(result[0].opciones).toEqual(["A", "B"]);
    expect(result[0].obligatoriedad).toBe("OBLIGATORIO");
  });

  it("ignores overrides for campos not in canonical", () => {
    const canonical = [{ campo: "z", obligatoriedad: "OPCIONAL" }];
    const overrides = [
      {
        campo: "no_existe",
        default_value_override: "x",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "1.0.0",
      },
    ];
    const result = applyCapa3Overrides(canonical, overrides);
    expect(result).toEqual(canonical);
  });

  it("does not filter overrides when canonicalVersion is omitted (legacy behavior)", () => {
    const canonical = [{ campo: "x", obligatoriedad: "OPCIONAL", default: "old" }];
    const overrides = [
      {
        campo: "x",
        default_value_override: "new",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "0.9.0",
      },
    ];
    // No third arg → overrides aplican aunque la versión esté pasada de moda.
    const result = applyCapa3Overrides(canonical, overrides);
    expect(result[0].default).toBe("new");
  });

  it("applies override when compatible_with_canonical_version matches canonicalVersion", () => {
    const canonical = [{ campo: "x", obligatoriedad: "OPCIONAL", default: "old" }];
    const overrides = [
      {
        campo: "x",
        default_value_override: "new",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "1.0.0",
      },
    ];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = applyCapa3Overrides(canonical, overrides, "1.0.0");
    expect(result[0].default).toBe("new");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("ignores override (with console.warn) when compatible_with_canonical_version mismatches", () => {
    const canonical = [{ campo: "x", obligatoriedad: "OPCIONAL", default: "old" }];
    const overrides = [
      {
        campo: "x",
        default_value_override: "new_stale",
        opciones_override: ["A", "B"],
        obligatoriedad_override: "OBLIGATORIO",
        compatible_with_canonical_version: "0.9.0",
      },
    ];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = applyCapa3Overrides(canonical, overrides, "1.0.0");
    // Override ignorado en todas sus dimensiones (default, opciones, obligatoriedad).
    expect(result[0].default).toBe("old");
    expect(result[0].opciones).toBeUndefined();
    expect(result[0].obligatoriedad).toBe("OPCIONAL");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("0.9.0");
    expect(warnSpy.mock.calls[0][0]).toContain("1.0.0");
  });

  it("when mixed overrides arrive, applies only the version-compatible ones", () => {
    const canonical = [
      { campo: "a", default: "a-old" },
      { campo: "b", default: "b-old" },
    ];
    const overrides = [
      {
        campo: "a",
        default_value_override: "a-new",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "1.0.0",
      },
      {
        campo: "b",
        default_value_override: "b-new",
        opciones_override: null,
        obligatoriedad_override: null,
        compatible_with_canonical_version: "0.9.0",
      },
    ];
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = applyCapa3Overrides(canonical, overrides, "1.0.0");
    expect(result[0].default).toBe("a-new"); // compatible → aplicado
    expect(result[1].default).toBe("b-old"); // incompatible → ignorado
  });
});
