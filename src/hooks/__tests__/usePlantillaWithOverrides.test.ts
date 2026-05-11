// src/hooks/__tests__/usePlantillaWithOverrides.test.ts
import { describe, it, expect } from "vitest";
import { applyCapa3Overrides } from "../usePlantillaWithOverrides";

describe("applyCapa3Overrides — pure merge function", () => {
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
});
