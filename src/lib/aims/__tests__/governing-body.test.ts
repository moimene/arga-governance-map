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
  });

  it("el panel se pinta sólo con el órgano que la función resuelve", () => {
    // ANTES: `toContain("aiGovernanceBodySlug")`. Lo satisfacía la LÍNEA DE
    // IMPORT: borrar la llamada real y dejar el import muerto dejaba el gate en
    // verde con el panel pintándose siempre. Ahora se comprueba el
    // COMPORTAMIENTO: que el render del panel está condicionado al valor que
    // devuelve la función, y que ese valor es distinto por tenant.
    const src = readFileSync(DASH, "utf8");

    // 1. Hay una llamada de verdad, con argumento, no sólo el identificador.
    const llamadas = src.match(/aiGovernanceBodySlug\s*\([^)]+\)/g) ?? [];
    expect(llamadas.length, "no hay ninguna llamada a aiGovernanceBodySlug con argumento")
      .toBeGreaterThan(0);

    // 2. Su resultado ALIMENTA la consulta del órgano, y el panel se pinta
    //    condicionado a lo que esa consulta devuelve. Se sigue la cadena
    //    entera: si alguien deja la llamada como decorado y pinta el panel
    //    incondicionalmente, esto cae.
    const consulta = src.match(/const\s*\{\s*data:\s*(\w+)\s*\}\s*=\s*useBodyBySlug\(\s*aiGovernanceBodySlug\(/);
    expect(
      consulta,
      "el slug resuelto no alimenta useBodyBySlug: el panel no depende del tenant",
    ).not.toBeNull();
    const organo = consulta![1];
    expect(
      new RegExp(`\\{\\s*${organo}\\s*&&`).test(src),
      `el panel no está condicionado a ${organo}: se resuelve el órgano y se pinta igual`,
    ).toBe(true);

    // 3. Y la condición discrimina de verdad: la función devuelve valores
    //    distintos por tenant, así que la puerta se abre para uno y no para otro.
    expect(aiGovernanceBodySlug(GARRIGUES)).toBeTruthy();
    expect(aiGovernanceBodySlug(ARGA)).toBeNull();
  });
});
