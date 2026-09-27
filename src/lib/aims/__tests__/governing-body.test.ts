import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  resolveAiGovernanceBodyId,
  resolveGoverningBodyIdFromPolicies,
  resolveGoverningBodyIdFromSubjects,
} from "../governing-body";

const COMITE = "432e420b-4db1-44f1-81da-e3575b1d3dec"; // Comité de Gobernanza de la IA (Garrigues, Cloud)
const PI_30 = "d6d2f0db-3e60-49c4-a71f-eb472d899764"; // PI-30 (Garrigues, Cloud)

describe("resolveGoverningBodyIdFromSubjects — el sujeto manda primero", () => {
  it("resuelve el primer sujeto con órgano acreditado", () => {
    expect(
      resolveGoverningBodyIdFromSubjects([
        { governing_body_id: null },
        { governing_body_id: COMITE },
      ]),
    ).toBe(COMITE);
  });

  it("sin ningún sujeto con órgano, null — no se fabrica uno", () => {
    expect(resolveGoverningBodyIdFromSubjects([])).toBeNull();
    expect(resolveGoverningBodyIdFromSubjects([{ governing_body_id: null }])).toBeNull();
  });
});

describe("resolveGoverningBodyIdFromPolicies — la política, cuando no hay sujeto", () => {
  it("resuelve el owner_body_id de la política del primer sistema que la tiene", () => {
    expect(
      resolveGoverningBodyIdFromPolicies(
        [{ ai_policy_id: null }, { ai_policy_id: PI_30 }],
        [{ id: PI_30, owner_body_id: COMITE }],
      ),
    ).toBe(COMITE);
  });

  it("una política sin owner_body_id no resuelve nada", () => {
    expect(
      resolveGoverningBodyIdFromPolicies(
        [{ ai_policy_id: PI_30 }],
        [{ id: PI_30, owner_body_id: null }],
      ),
    ).toBeNull();
  });

  it("sin sistemas con política, o sin ninguna política que coincida, null", () => {
    expect(resolveGoverningBodyIdFromPolicies([], [])).toBeNull();
    expect(
      resolveGoverningBodyIdFromPolicies([{ ai_policy_id: "otra-politica" }], [{ id: PI_30, owner_body_id: COMITE }]),
    ).toBeNull();
  });
});

describe("resolveAiGovernanceBodyId — sujeto antes que política, y fallo cerrado", () => {
  // CONTROL POSITIVO (equivalente al de ARGA/Garrigues del mapa retirado):
  // con datos con forma real de Garrigues, resuelve el comité; con datos con
  // forma real de ARGA (sin sujetos ni política con owner_body_id), null.
  it("resuelve por sujeto cuando hay uno, aunque también haya política", () => {
    const OTRO = "00000000-0000-0000-0000-0000000000ff";
    expect(
      resolveAiGovernanceBodyId({
        subjects: [{ governing_body_id: COMITE }],
        systems: [{ ai_policy_id: PI_30 }],
        policies: [{ id: PI_30, owner_body_id: OTRO }],
      }),
    ).toBe(COMITE);
  });

  it("cae a la política cuando no hay sujeto con órgano", () => {
    expect(
      resolveAiGovernanceBodyId({
        subjects: [],
        systems: [{ ai_policy_id: PI_30 }],
        policies: [{ id: PI_30, owner_body_id: COMITE }],
      }),
    ).toBe(COMITE);
  });

  it("ARGA hoy: sin sujetos y sin ai_policy_id en sus sistemas, null — sin panel", () => {
    // Medido en Cloud (2026-09-27): PR-024 (política de ARGA) sigue con
    // owner_body_id NULL y los 8 sistemas de ARGA sin ai_policy_id. No se le
    // fabrica un órgano de gobierno de la IA que nadie ha constituido.
    expect(
      resolveAiGovernanceBodyId({ subjects: [], systems: [{ ai_policy_id: null }], policies: [] }),
    ).toBeNull();
  });

  it("Garrigues hoy: sin sujetos y sin ai_policy_id sembrado en sus sistemas, también null", () => {
    // Medido en Cloud (2026-09-27): PI-30.owner_body_id SÍ es el comité, pero
    // ninguno de los 6 sistemas de Garrigues tiene ai_policy_id todavía — eso
    // lo siembra el carril C (F2.T16). Hasta entonces, el panel de Garrigues
    // desaparece también: es el precio de resolver por dato y no por mapa, y
    // está declarado en el ledger de esta tarea, no escrito aquí por el agente.
    expect(
      resolveAiGovernanceBodyId({ subjects: [], systems: [{ ai_policy_id: null }], policies: [{ id: PI_30, owner_body_id: COMITE }] }),
    ).toBeNull();
  });

  it("un tenant sin ningún dato (grupo nuevo, recién dado de alta) también es null", () => {
    expect(resolveAiGovernanceBodyId({ subjects: [], systems: [], policies: [] })).toBeNull();
  });
});

describe("el Dashboard de AI Governance no lleva un tenant ni un órgano dentro", () => {
  const DASH = "src/pages/ai-governance/Dashboard.tsx";

  it("no hardcodea el slug de un tenant en superficie compartida", () => {
    // El Dashboard lo ven TODOS los tenants. Un slug de despacho escrito ahí se
    // pintaría también en la consola de la aseguradora — el mismo defecto que
    // el carril de F1 retiró de la pestaña FRIA, y que MOI-150/F2.T9 retira
    // aquí del propio órgano de gobierno de la IA.
    const src = readFileSync(DASH, "utf8");
    expect(src.length, "no se ha leído el Dashboard").toBeGreaterThan(1000);
    expect(src, "el slug del comité está escrito en la página, no resuelto por dato")
      .not.toContain("garrigues-comite-gobernanza-ia");
    expect(src, "hay un UUID de tenant en duro en la página").not.toMatch(/00000000-0000-0000-0000-0000000000\d\d/);
  });

  it("el panel se pinta sólo con el órgano que `useAiGovernanceBody` resuelve", () => {
    // El mapa fijo `AI_GOVERNANCE_BODY_BY_TENANT` está retirado del programa:
    // el Dashboard ya no importa nada de `@/lib/aims/governing-body`, delega
    // toda la resolución al hook `useAiGovernanceBody`.
    const src = readFileSync(DASH, "utf8");
    expect(src, "el Dashboard sigue importando la hoja retirada").not.toContain("aims/governing-body");
    expect(src).toContain("useAiGovernanceBody");

    const consulta = src.match(/const\s*\{\s*data:\s*(\w+)\s*\}\s*=\s*useAiGovernanceBody\(\)/);
    expect(
      consulta,
      "useAiGovernanceBody() no alimenta ninguna variable local: el panel no depende de su resultado",
    ).not.toBeNull();
    const organo = consulta![1];
    expect(
      new RegExp(`\\{\\s*${organo}\\s*&&`).test(src),
      `el panel no está condicionado a ${organo}: se resuelve el órgano y se pinta igual`,
    ).toBe(true);
  });
});
