import { describe, expect, it } from "vitest";
import { usaFixturesDemo } from "@/lib/tenant-fixtures";

describe("usaFixturesDemo", () => {
  it("ARGA (branding NULL) y Garrigues (sin la clave) no cambian", () => {
    expect(usaFixturesDemo(null)).toBe(true);
    expect(usaFixturesDemo({ nombre: "Garrigues", tokens: {} })).toBe(true);
  });

  it("solo se apaga con la declaración expresa", () => {
    expect(usaFixturesDemo({ nombre: "Grupo Nuevo", fixtures: "none" })).toBe(false);
    // Un valor que no es la declaración no apaga nada: fallar cerrado aquí
    // vaciaría la consola de un tenant por una errata en su branding.
    expect(usaFixturesDemo({ nombre: "X", fixtures: "None" })).toBe(true);
    expect(usaFixturesDemo({ nombre: "X", fixtures: "" })).toBe(true);
  });
});
