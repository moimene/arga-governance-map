// src/test/grc/afirmaciones-grc.test.ts
//
// Dos defectos que el cierre del 2026-09-05 dio por corregidos y NO lo estaban.
// Los cazó la pasada adversarial del 2026-09-06, y los dos tienen la misma
// forma: se corrigió la superficie que se estaba mirando y sobrevivió la misma
// afirmación por otro camino.
//
//  1. TPRM: el RENDER pasó a pintar «sin dato» para la cláusula ausente, pero
//     la ESCRITURA seguía partiendo de un objeto con las seis a `true`. Marcar
//     una cláusula persistía cinco conformidades DORA no declaradas.
//     Se juzga por COMPORTAMIENTO (`nextContractChecks`), no por texto: el
//     defecto era un literal de objeto por defecto, justo lo que un grep no
//     sujeta.
//  2. Incidentes: los TOASTS dejaron de afirmar transmisión a la autoridad y a
//     clientes, pero el rótulo PERSISTENTE del botón seguía diciendo
//     «Comunicación a Clientes Enviada». Un toast se desvanece; el rótulo se
//     queda en pantalla.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { nextContractChecks } from "@/lib/grc/contract-checks";

const raiz = process.cwd();
const leer = (rel: string) => sinComentarios(readFileSync(join(raiz, rel), "utf8"));

describe("TPRM — marcar una cláusula no declara las otras cinco", () => {
  it("desde «sin dato», marcar una cláusula escribe SOLO esa", () => {
    const out = nextContractChecks(undefined, "audit_rights");
    expect(out).toEqual({ audit_rights: true });
    // Lo que importa no es que valga true, sino que las otras cinco sigan
    // AUSENTES: `undefined` es lo que la pantalla pinta como «sin dato».
    expect(Object.keys(out)).toHaveLength(1);
    for (const k of [
      "supervisory_inspection",
      "data_return_insolvency",
      "exit_plan_tested",
      "bcm_tested",
      "incident_assistance",
    ] as const) {
      expect(out[k]).toBeUndefined();
    }
  });

  it("conserva lo ya declarado y alterna solo la cláusula tocada", () => {
    const previo = { audit_rights: true, bcm_tested: false } as const;
    const out = nextContractChecks(previo, "bcm_tested");
    expect(out).toEqual({ audit_rights: true, bcm_tested: true });
    expect(nextContractChecks(out, "audit_rights")).toEqual({
      audit_rights: false,
      bcm_tested: true,
    });
  });

  it("un objeto vacío no es lo mismo que seis conformidades", () => {
    // Control negativo del defecto original: si alguien reintroduce el objeto
    // por defecto con las seis a `true`, este recuento deja de ser 1.
    expect(Object.keys(nextContractChecks({}, "exit_plan_tested"))).toHaveLength(1);
  });

  it("la pantalla no reintroduce el objeto por defecto", () => {
    const src = leer("src/pages/grc/TPRM.tsx");
    expect(src).toContain("nextContractChecks");
    // Control positivo: el fichero se leyó de verdad y es el que toca.
    expect(src).toContain("contract_checks");
    expect(src).not.toMatch(/contract_checks\s*\?\?\s*\{\s*audit_rights:\s*true/);
  });
});

describe("Incidentes GRC — el rótulo persistente no afirma un envío", () => {
  const src = leer("src/pages/grc/IncidenteDetalle.tsx");

  it("el fichero se leyó y contiene el panel de comunicación a clientes", () => {
    expect(src).toContain("handleSendClientCommunication");
    expect(src).toContain("clientCommSent");
  });

  it("no queda ningún rótulo que declare la comunicación enviada o remitida", () => {
    // Se prohíbe la AFIRMACIÓN, no la palabra: «sin envío» debe poder escribirse.
    expect(src).not.toMatch(/Comunicaci[óo]n a Clientes Enviada/i);
    expect(src).not.toMatch(/"[^"]*\bEnviada\b[^"]*"/);
    expect(src).not.toMatch(/transmitid[ao] formalmente/i);
    expect(src).not.toMatch(/remitid[ao] (?:formalmente )?a (?:la autoridad|clientes)/i);
  });

  it("y sí dice explícitamente que no hay envío", () => {
    expect(src).toMatch(/sin env[íi]o/i);
  });
});
