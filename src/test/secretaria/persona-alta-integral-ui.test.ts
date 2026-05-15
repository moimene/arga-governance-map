import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const personaNueva = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonaNuevaStepper.tsx"),
  "utf8",
);

const personaDetalle = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonaDetalle.tsx"),
  "utf8",
);

const personasHook = readFileSync(
  join(process.cwd(), "src/hooks/usePersonasCanonical.ts"),
  "utf8",
);

describe("persona alta integral UI contract", () => {
  it("replaces the abbreviated insert with fn_create_persona_completa", () => {
    expect(personaNueva).toMatch(/Alta completa de persona/);
    expect(personaNueva).toMatch(/useCreatePersonaCompleta/);
    expect(personaNueva).not.toMatch(/\.from\("persons"\)\s*[\s\S]*?\.insert\(/);
    expect(personasHook).toMatch(/supabase\.rpc\("fn_create_persona_completa"/);
  });

  it("requires complete onboarding sections before submit", () => {
    for (const label of [
      "Identidad",
      "Contacto",
      "Registro",
      "Gobierno",
      "Tipo de evidencia de alta",
      "Referencia de evidencia",
      "Domicilio notificaciones",
    ]) {
      expect(personaNueva).toContain(label);
    }
  });

  it("reads and renders persona_profiles on the detail page", () => {
    expect(personasHook).toMatch(/export function usePersonaProfile/);
    expect(personaDetalle).toMatch(/usePersonaProfile\(id\)/);
    expect(personaDetalle).toMatch(/Alta integral/);
    expect(personaDetalle).toMatch(/Esta persona no tiene perfil integral registrado/);
  });
});
