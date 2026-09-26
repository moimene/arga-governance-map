// MOI-193: la lista de ámbitos propuesta para `tenants.branding.scopes` de
// Garrigues (migración 20260926119300, aún sin aplicar en Cloud — pendiente
// de validación humana) debe derivar exactamente de `entities-catalog.ts`
// (única fuente de verdad del perímetro, G1), sin inventar ni olvidar
// ninguna jurisdicción. Si el catálogo cambia (alta/baja de una filial en
// otro país) este test rompe y avisa de que la migración/probe quedaron
// desactualizados frente a la fuente.
import { describe, expect, it } from "vitest";
import { GARRIGUES_ENTITIES } from "../../../scripts/garrigues/entities-catalog";

// Nombres en español de las jurisdicciones (código ISO del catálogo → país).
// Traducción literal, sin agrupar por región (agrupar sería un criterio de
// negocio no verificado — ver nota en la migración).
const JURISDICTION_NAME: Record<string, string> = {
  ES: "España",
  PT: "Portugal",
  UK: "Reino Unido",
  US: "Estados Unidos",
  MA: "Marruecos",
  PL: "Polonia",
  CO: "Colombia",
  PE: "Perú",
  MX: "México",
  CL: "Chile",
  BE: "Bélgica",
  CN: "China",
};

// Lista propuesta, tal cual escrita en
// supabase/migrations/20260926119300_garrigues_branding_scopes_reales.sql
const PROPUESTA_MIGRACION = [
  "Grupo Garrigues (Global)",
  "España",
  "México",
  "Chile",
  "Portugal",
  "Colombia",
  "Reino Unido",
  "Estados Unidos",
  "Marruecos",
  "Polonia",
  "Perú",
  "Bélgica",
  "China",
];

describe("MOI-193 — ámbitos propuestos de Garrigues derivan del catálogo real", () => {
  it("cada jurisdicción del catálogo tiene nombre traducido y aparece en la propuesta", () => {
    const jurisdiccionesCatalogo = new Set(GARRIGUES_ENTITIES.map((e) => e.jurisdiction));
    for (const j of jurisdiccionesCatalogo) {
      expect(JURISDICTION_NAME[j], `Falta traducción para la jurisdicción ${j}`).toBeDefined();
      expect(
        PROPUESTA_MIGRACION,
        `La propuesta no incluye ${JURISDICTION_NAME[j]} (${j}), presente en el catálogo`,
      ).toContain(JURISDICTION_NAME[j]);
    }
  });

  it("la propuesta no inventa ninguna jurisdicción ajena al catálogo", () => {
    const jurisdiccionesCatalogo = new Set(GARRIGUES_ENTITIES.map((e) => e.jurisdiction));
    const nombresValidos = new Set(
      [...jurisdiccionesCatalogo].map((j) => JURISDICTION_NAME[j]),
    );
    const paisesPropuesta = PROPUESTA_MIGRACION.filter((s) => s !== "Grupo Garrigues (Global)");
    for (const pais of paisesPropuesta) {
      expect(nombresValidos.has(pais), `${pais} no corresponde a ninguna jurisdicción del catálogo`).toBe(true);
    }
  });

  it("tiene exactamente 12 jurisdicciones + 1 ámbito Global (13 en total), no las 8 citadas en CLAUDE.md", () => {
    const jurisdiccionesCatalogo = new Set(GARRIGUES_ENTITIES.map((e) => e.jurisdiction));
    expect(jurisdiccionesCatalogo.size).toBe(12);
    expect(PROPUESTA_MIGRACION.length).toBe(13);
  });

  it("el primer ámbito es Global y no hay duplicados", () => {
    expect(PROPUESTA_MIGRACION[0]).toBe("Grupo Garrigues (Global)");
    expect(new Set(PROPUESTA_MIGRACION).size).toBe(PROPUESTA_MIGRACION.length);
  });
});
