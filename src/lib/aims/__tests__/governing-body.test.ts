import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { aiGovernanceBodySlug } from "../governing-body";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARRIGUES = "00000000-0000-0000-0000-000000000002";

describe("órgano de gobierno de la IA — resuelve por tenant y falla cerrado", () => {
  // CONTROL POSITIVO. Sin esto, un mapa vacío pondría verdes de golpe TODAS las
  // aserciones de abajo, que son de ausencia: "ARGA no tiene órgano" sería
  // indistinguible de "la función no encuentra nada nunca". Es la forma que hoy
  // hemos llamado nº7.
  it("resuelve el tenant que SÍ tiene órgano declarado", () => {
    expect(aiGovernanceBodySlug(GARRIGUES)).toBe("garrigues-comite-gobernanza-ia");
  });

  it("ARGA no tiene órgano de IA: no se le fabrica uno", () => {
    // Verificado en Cloud (2026-08-30): no hay ninguna fila de
    // `governing_bodies` con ese slug para ARGA. Inventarle un órgano de
    // gobierno de la IA sería afirmar una gobernanza que nadie ha constituido.
    expect(aiGovernanceBodySlug(ARGA)).toBeNull();
  });

  it("un tenant desconocido no hereda el órgano de otro", () => {
    expect(aiGovernanceBodySlug("00000000-0000-0000-0000-000000000009")).toBeNull();
    expect(aiGovernanceBodySlug(null)).toBeNull();
    expect(aiGovernanceBodySlug(undefined)).toBeNull();
    expect(aiGovernanceBodySlug("")).toBeNull();
  });

  it("una clave del prototipo no devuelve una función", () => {
    // Acceso directo a un Record devuelve `Object.prototype.constructor` para
    // "constructor". El lookup usa hasOwnProperty por eso, igual que
    // `login-brands.ts`.
    for (const clave of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(aiGovernanceBodySlug(clave), `${clave} se escapa del mapa`).toBeNull();
    }
  });
});

describe("el Dashboard de AI Governance no lleva un tenant dentro", () => {
  const DASH = "src/pages/ai-governance/Dashboard.tsx";

  it("no hardcodea el slug de un tenant en superficie compartida", () => {
    // El Dashboard lo ven TODOS los tenants. Un slug de despacho escrito ahí se
    // pintaría también en la consola de la aseguradora — el mismo defecto que
    // este carril acaba de retirar de la pestaña FRIA, donde el panel citaba
    // PI-30 sin puerta de tenant y los únicos sistemas de Cloud eran de ARGA.
    const src = readFileSync(DASH, "utf8");
    expect(src.length, "no se ha leído el Dashboard").toBeGreaterThan(1000);
    expect(src, "el slug del comité está escrito en la página, no resuelto por tenant")
      .not.toContain("garrigues-comite-gobernanza-ia");
    expect(src, "hay un UUID de tenant en duro en la página").not.toMatch(/00000000-0000-0000-0000-0000000000\d\d/);
    // Y la puerta está puesta: se resuelve por tenant, no se pinta siempre.
    expect(src, "el panel no se resuelve por tenant").toContain("aiGovernanceBodySlug");
  });
});
