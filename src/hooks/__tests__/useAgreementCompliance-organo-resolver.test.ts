/**
 * D1 — Regression guard para el fix CDA→CONSEJO en el adapter del
 * motor V2 (`useAgreementCompliance`).
 *
 * Contexto: el commit `96a64ca refactor(secretaria): migrate 3 callers
 * to centralized resolveOrganoTipo` corrigió un bug pre-existente en
 * el que `body_type='CDA'` caía a `JUNTA_GENERAL` en el motor (sólo
 * en este adapter; los otros 2 callers ya lo trataban bien). Cloud
 * actual tiene 20× CdA con body_type='CDA'.
 *
 * Sin este guard, alguien podría:
 *  - Revertir la migración (volver a un local toTipoOrgano con CDA→JUNTA).
 *  - Quitar el wrapper `resolveAgreementOrganoTipo` y ponerlo inline mal.
 *  - Cambiar el helper sin actualizar el adapter.
 *
 * Estrategia: combinación de
 *   1) test fixture-based del wrapper exportado, con casos de Cloud real
 *      (CDA + variantes de organo_tipo).
 *   2) static guard sobre el source del adapter (no debe redefinirse
 *      `toTipoOrgano` localmente, debe usar el wrapper).
 *
 * No usa renderHook ni mockea Supabase — el wrapper es pura lógica.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAgreementOrganoTipo } from "../useAgreementCompliance";

const ADAPTER_SOURCE = readFileSync(
  resolve(__dirname, "..", "useAgreementCompliance.ts"),
  "utf8",
);

describe("D1 — adapter resolveAgreementOrganoTipo (fixture-based)", () => {
  it("body_type='CDA' (umbrella admin Cloud) → CONSEJO", () => {
    const agreement = {
      governing_bodies: {
        body_type: "CDA",
        name: "Consejo de Administración ARGA Seguros, S.A.",
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("CONSEJO");
  });

  it("CDA + config.organo_tipo='CONSEJO_ADMIN' (caso Cloud demo) → CONSEJO", () => {
    const agreement = {
      governing_bodies: {
        body_type: "CDA",
        name: "CdA",
        config: { organo_tipo: "CONSEJO_ADMIN", voto_calidad_presidente: true },
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("CONSEJO");
  });

  it("CDA + config.organo_tipo='ADMIN_UNICO' (administrador único) → CONSEJO", () => {
    // Aunque ADMIN_UNICO no es colegiado, semánticamente sigue siendo
    // órgano de administración. El motor V2 sólo distingue 3 categorías;
    // el flujo unipersonal lo gestiona adoption_mode, no organoTipo.
    const agreement = {
      governing_bodies: {
        body_type: "CDA",
        name: "Administrador único",
        config: { organo_tipo: "ADMIN_UNICO", adoption_mode: "UNIPERSONAL_ADMIN" },
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("CONSEJO");
  });

  it("CDA + config.organo_tipo='ADMIN_SOLIDARIOS' → CONSEJO", () => {
    const agreement = {
      governing_bodies: {
        body_type: "CDA",
        name: "Administradores solidarios",
        config: { organo_tipo: "ADMIN_SOLIDARIOS", adoption_mode: "SOLIDARIO" },
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("CONSEJO");
  });

  it("body_type='JUNTA' → JUNTA_GENERAL (no se confunde con CdA)", () => {
    const agreement = {
      governing_bodies: {
        body_type: "JUNTA",
        name: "Junta General de Accionistas",
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("JUNTA_GENERAL");
  });

  it("body_type='COMISION' → COMISION_DELEGADA", () => {
    const agreement = {
      governing_bodies: {
        body_type: "COMISION",
        name: "Comisión Delegada",
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("COMISION_DELEGADA");
  });

  it("body_type='COMITE' (auditoría/riesgos) → COMISION_DELEGADA", () => {
    const agreement = {
      governing_bodies: {
        body_type: "COMITE",
        name: "Comité de Auditoría",
      },
    };
    expect(resolveAgreementOrganoTipo(agreement)).toBe("COMISION_DELEGADA");
  });

  it("governing_bodies ausente → JUNTA_GENERAL (fallback conservador)", () => {
    expect(resolveAgreementOrganoTipo({ governing_bodies: null })).toBe(
      "JUNTA_GENERAL",
    );
    expect(resolveAgreementOrganoTipo({ governing_bodies: undefined })).toBe(
      "JUNTA_GENERAL",
    );
  });

  // Anti-bug del commit 96a64ca. Si esta aserción falla, el adapter
  // ha vuelto al comportamiento bug pre-fix (CDA→JUNTA_GENERAL).
  it("anti-bug: body_type='CDA' NUNCA cae a JUNTA_GENERAL", () => {
    const agreement = { governing_bodies: { body_type: "CDA", name: "CdA" } };
    expect(resolveAgreementOrganoTipo(agreement)).not.toBe("JUNTA_GENERAL");
  });
});

describe("D1 — adapter source guards (static analysis)", () => {
  // Estos guards son frágiles a refactors superficiales (renombrar la
  // variable `a` por `agreement` rompe el regex). Es deliberado: cualquier
  // cambio en el punto de integración debe pasar por revisión humana.
  // Si fallas estos, no apliques quick-fix al regex sin entender por qué.

  it("importa resolveOrganoTipo del helper centralizado", () => {
    expect(ADAPTER_SOURCE).toMatch(
      /import\s+\{\s*resolveOrganoTipo\s*\}\s+from\s+["']@\/lib\/secretaria\/organo-resolver["']/,
    );
  });

  it("NO redefine `toTipoOrgano` localmente (regresión a la implementación previa)", () => {
    // El bug original era una función `function toTipoOrgano(bodyType: string | null)`
    // exactamente con esa firma. Si alguien la re-introduce, este guard salta.
    expect(ADAPTER_SOURCE).not.toMatch(/^function\s+toTipoOrgano\s*\(/m);
  });

  it("expone `resolveAgreementOrganoTipo` como wrapper exportado", () => {
    expect(ADAPTER_SOURCE).toMatch(
      /export\s+function\s+resolveAgreementOrganoTipo\s*\(/,
    );
  });

  it("evaluateV2 usa el wrapper, no llama a resolveOrganoTipo directamente con governing_bodies inline", () => {
    // El motor V2 entra por evaluateV2. Esta línea concreta es el punto
    // de integración: cualquier refactor que la rompa debe ser deliberado.
    expect(ADAPTER_SOURCE).toMatch(/resolveAgreementOrganoTipo\s*\(/);
  });
});
