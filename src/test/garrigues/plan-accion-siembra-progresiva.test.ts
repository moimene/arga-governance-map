// src/test/garrigues/plan-accion-siembra-progresiva.test.ts
//
// ORDEN VIGENTE 2026-09-07: el tenant Garrigues se siembra de forma PROGRESIVA
// con dato simulado a partir de fuentes reales, y ese dato PERSISTE. La orden
// anterior —«no se siembra, porque fabricarlo haría el dato demo
// indistinguible del real»— queda derogada.
//
// El aviso de `/grc/m/audit/action-plans` era esa orden escrita como dato: se
// renderiza al usuario, así que si vuelve, el producto vuelve a decirle a un
// lector que se decidió no sembrar. Este gate fija lo que SE PINTA.
//
// Se asierta sobre los CAMPOS de la constante y no sobre el texto del fichero:
// el comentario que explica la derogación cita la frase derogada, y un grep
// sobre el fichero se dispararía contra su propia justificación. En este repo
// ya ocurrió tres veces el mismo día, y la salida fácil es borrar el
// comentario. Se juzga lo que se renderiza, no la prosa que lo justifica.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { PLAN_ACCION_AUSENCIA } from "../../../scripts/garrigues/hallazgos/hallazgos-penales";

const PANTALLA = "src/pages/grc/modules/audit/ActionPlans.tsx";

describe("el aviso de planes de acción describe un hueco por sembrar, no una decisión de no sembrar", () => {
  it("no le cuenta al usuario que se decidió no sembrar", () => {
    const pintado = [
      PLAN_ACCION_AUSENCIA.titulo,
      PLAN_ACCION_AUSENCIA.motivo,
      PLAN_ACCION_AUSENCIA.consecuencia,
    ].join(" ");
    // Control positivo PRIMERO: si alguien vaciara los campos, todo lo de
    // abajo pasaría sin decir nada.
    expect(pintado.length).toBeGreaterThan(200);
    for (const derogado of [/indistinguible/i, /veros[ií]mil/i, /rellenar este espacio/i]) {
      expect(pintado, `el aviso reintroduce la orden derogada: ${derogado}`).not.toMatch(derogado);
    }
  });

  it("y sí dice que están por incorporar y que lo que llegue irá marcado como simulado", () => {
    expect(PLAN_ACCION_AUSENCIA.consecuencia).toMatch(/a[uú]n no|todav[ií]a/i);
    expect(PLAN_ACCION_AUSENCIA.consecuencia).toMatch(/simulad/i);
    // La honestidad del aviso mientras el hueco siga vacío: sigue nombrando la
    // fuente y lo que esa fuente NO publica.
    expect(PLAN_ACCION_AUSENCIA.motivo).toContain("no publica los planes concretos");
    expect(PLAN_ACCION_AUSENCIA.fuente).toContain("PPD-01");
  });

  it("y desaparece solo en cuanto haya un plan: la pantalla lo gatea por el recuento", () => {
    const src = sinComentarios(readFileSync(join(process.cwd(), PANTALLA), "utf8"));
    // Sin esta arista, sembrar dejaría el aviso puesto sobre la lista sembrada
    // — que es la forma de que progresar ensucie la pantalla.
    expect(src).toContain("plans.length === 0 && hayProcedenciaDeclarada");
    // Control discriminante: el aviso sigue siendo solo del tenant que declara
    // su procedencia; ARGA conserva su texto genérico.
    expect(src).toContain("PLAN_ACCION_AUSENCIA.tenantId");
    expect(src).toContain("No hay planes de acción disponibles.");
  });
});
