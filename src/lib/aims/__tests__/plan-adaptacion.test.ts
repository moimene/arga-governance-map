import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  generarPlanDeAdaptacion,
  prioridadDe,
  resumenPlan,
  vencimientoPropuesto,
  type AccionPDA,
} from "../plan-adaptacion";

/**
 * El Plan de Adaptación como acciones y no como prosa.
 *
 * En el primer piloto real vive entero dentro de `notes`: seis acciones con
 * responsable, prioridad y fecha escritas a mano en un párrafo. Así no se puede
 * filtrar, ni ordenar, ni saber cuántas vencen — que es justo lo que la
 * auditoría exige de un plan de acción.
 */

const HOY = new Date("2026-09-07T00:00:00Z");

const f = (code: string, planCode: string, difficulty: string | null = null) => ({
  code,
  title: `Acción de ${code}`,
  status: "L1",
  planCode,
  difficulty,
  requirementCode: "RISK_MGMT",
});

describe("el plan sale de las medidas con brecha, no de un párrafo", () => {
  it("sólo generan acción los planes 01, 02 y 04", () => {
    // `03` es adaptación completa y `05` es «no necesaria»: ni una ni otra
    // exigen nada. Si generaran acción, el plan tendría tantas filas como
    // medidas y dejaría de ser un plan.
    const acciones = generarPlanDeAdaptacion(
      [f("M1", "01"), f("M2", "02"), f("M3", "03"), f("M4", "04"), f("M5", "05")],
      [],
      HOY,
    );
    expect(acciones.map((a) => a.measureCode)).toEqual(["M1", "M2", "M4"]);
  });

  it("la prioridad sale del plan y de la dificultad", () => {
    // «No existe nada» es siempre lo más urgente; «existe media medida» sube a
    // alta cuando además se graduó difícil, porque es lo que más tarda.
    expect(prioridadDe("01", null)).toBe("ALTA");
    expect(prioridadDe("01", "02")).toBe("ALTA");
    expect(prioridadDe("02", "02")).toBe("MEDIA");
    expect(prioridadDe("02", "00")).toBe("ALTA");
    expect(prioridadDe("04", "00")).toBe("ALTA");
    expect(prioridadDe("03", "00")).toBe("BAJA");
  });

  it("el vencimiento propuesto se separa por prioridad", () => {
    expect(vencimientoPropuesto("ALTA", HOY)).toBe("2026-11-06");
    expect(vencimientoPropuesto("MEDIA", HOY)).toBe("2027-01-05");
    expect(vencimientoPropuesto("BAJA", HOY)).toBe("2027-03-06");
  });

  it("CONSERVA lo editado a mano cuando se regenera", () => {
    // La propiedad que importa: quien asignó un responsable y una fecha no
    // puede perderlos porque alguien vuelva a tocar una medida.
    const primera = generarPlanDeAdaptacion([f("M1", "01"), f("M2", "02")], [], HOY);
    const editada: AccionPDA[] = primera.map((a) =>
      a.measureCode === "M1"
        ? { ...a, owner_id: "persona-1", vence_el: "2026-10-01", estado: "EN_CURSO" as const }
        : a,
    );

    // Se vuelve a tocar M2 y se regenera el plan entero.
    const regenerada = generarPlanDeAdaptacion([f("M1", "01"), f("M2", "01")], editada, HOY);
    const m1 = regenerada.find((a) => a.measureCode === "M1");
    expect(m1?.owner_id, "el responsable asignado se ha perdido al regenerar").toBe("persona-1");
    expect(m1?.vence_el, "la fecha editada se ha perdido al regenerar").toBe("2026-10-01");
    expect(m1?.estado).toBe("EN_CURSO");
  });

  it("una medida que deja de tener brecha sale del plan", () => {
    const previas = generarPlanDeAdaptacion([f("M1", "01")], [], HOY);
    expect(previas).toHaveLength(1);
    // La medida sube a L5: su acción ya no tiene sujeto.
    const despues = generarPlanDeAdaptacion([f("M1", "03")], previas, HOY);
    expect(despues).toHaveLength(0);
  });

  it("el resumen cuenta lo que hace falta seguir", () => {
    const acciones: AccionPDA[] = [
      { ...generarPlanDeAdaptacion([f("M1", "01")], [], HOY)[0], vence_el: "2026-01-01" },
      { ...generarPlanDeAdaptacion([f("M2", "02")], [], HOY)[0], owner_id: "p1" },
      { ...generarPlanDeAdaptacion([f("M3", "04")], [], HOY)[0], estado: "CERRADA", vence_el: "2026-01-01" },
    ];
    const r = resumenPlan(acciones, HOY);
    expect(r.total).toBe(3);
    expect(r.alta).toBe(1);
    expect(r.sinResponsable).toBe(2);
    // La cerrada no cuenta como vencida aunque su fecha haya pasado.
    expect(r.vencidas).toBe(1);
    expect(r.cerradas).toBe(1);
  });
});

describe("el plan y la custodia llegan a las pantallas", () => {
  it("el wizard genera el plan y lo persiste con la evaluación", () => {
    const src = readFileSync("src/pages/ai-governance/EvaluacionNueva.tsx", "utf8");
    expect(src).toMatch(/generarPlanDeAdaptacion\(/);
    expect(src, "el plan no se persiste con la fila").toMatch(/action_plan:\s*generarPlanDeAdaptacion/);
  });

  it("el informe pinta el plan y dice lo que la huella NO acredita", () => {
    const src = readFileSync("src/pages/ai-governance/EvaluacionDetalle.tsx", "utf8");
    expect(src).toMatch(/PlanDeAdaptacionEstructurado/);
    // Un hash de servidor acredita integridad y autoría, no fecha cierta:
    // presentarlo a secas sería la misma sobreafirmación que el módulo ya tuvo
    // con los sellos de EAD Trust.
    expect(src, "el informe presenta la huella sin decir lo que no acredita").toMatch(
      /No acredita fecha cierta/,
    );
  });
});
