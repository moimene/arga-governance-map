import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { checksVigentes } from "../checks-vigentes";

/**
 * Reevaluar un sistema no puede multiplicar sus controles.
 *
 * Medido en Cloud el 2026-09-07: «Motor de triaje de siniestros auto» tiene
 * **28 filas de `ai_compliance_checks` para 7 códigos** — cuatro evaluaciones,
 * 21 filas repetidas, y la consola las contaba como 28 controles. El sistema de
 * Garrigues (Harvey) tiene hoy 12 filas para 12 códigos y habría llegado a 24
 * en la siguiente ronda del piloto.
 *
 * El histórico NO se borra: cada fila la produjo una evaluación real. Se
 * corrige la LECTURA.
 */

const fila = (requirement_code: string, created_at: string, status = "CONFORME") => ({
  system_id: "sys-1",
  requirement_code,
  created_at,
  status,
});

describe("de cada requisito manda la comprobación más reciente", () => {
  it("cuatro evaluaciones de siete requisitos dan siete controles, no veintiocho", () => {
    const codigos = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"];
    const historico = ["2026-05-21", "2026-07-19", "2026-07-20", "2026-07-21"].flatMap((d) =>
      codigos.map((c) => fila(c, `${d}T10:00:00Z`)),
    );
    expect(historico, "el caso medido en Cloud").toHaveLength(28);
    expect(checksVigentes(historico)).toHaveLength(7);
  });

  it("gana la última escrita, no la primera", () => {
    const vigentes = checksVigentes([
      fila("R1", "2026-05-21T10:00:00Z", "NO_CONFORME"),
      fila("R1", "2026-07-19T10:00:00Z", "CONFORME"),
    ]);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].status, "una comprobación vieja pisa a la nueva").toBe("CONFORME");
  });

  it("con marcas iguales gana la que llega después (orden de escritura)", () => {
    const vigentes = checksVigentes([
      fila("R1", "2026-07-19T10:00:00Z", "NO_CONFORME"),
      fila("R1", "2026-07-19T10:00:00Z", "CONFORME"),
    ]);
    expect(vigentes[0].status).toBe("CONFORME");
  });

  it("no mezcla sistemas distintos", () => {
    const vigentes = checksVigentes([
      { ...fila("R1", "2026-07-19T10:00:00Z", "CONFORME"), system_id: "sys-1" },
      { ...fila("R1", "2026-07-20T10:00:00Z", "NO_CONFORME"), system_id: "sys-2" },
    ]);
    expect(vigentes).toHaveLength(2);
  });

  it("no descarta las filas huérfanas: las conserva sin pisarse entre ellas", () => {
    // Descartarlas sería perder dato, y colapsarlas en una clave común haría
    // que dos huérfanas distintas se comieran la una a la otra.
    const vigentes = checksVigentes([
      { system_id: null, requirement_code: "R1", created_at: "2026-07-19T10:00:00Z", status: "A" },
      { system_id: "sys-1", requirement_code: null, created_at: "2026-07-19T10:00:00Z", status: "B" },
    ]);
    expect(vigentes).toHaveLength(2);
  });

  it("aguanta created_at ausente o ilegible sin perder la fila", () => {
    const vigentes = checksVigentes([
      { system_id: "sys-1", requirement_code: "R1", created_at: null, status: "A" },
    ]);
    expect(vigentes).toHaveLength(1);
  });
});

/**
 * M01 (F1.T14): cada comprobación nueva lleva la evaluación de la que sale, y la
 * lectura la embebe (`evaluacion`). Sin eso, cerrar un autodiagnóstico SIN
 * contestar nada —que el camino de escritura deja en `BORRADOR` y aun así
 * inserta un `PENDIENTE` por requisito— tapaba una evaluación ya revisada por
 * el mero hecho de ser posterior.
 */
describe("un borrador no desplaza a una evaluación cerrada", () => {
  const deEvaluacion = (
    created_at: string,
    status: string,
    evaluacion: { status: string; reviewed_at: string | null } | null,
  ) => ({ ...fila("R1", created_at, status), assessment_id: evaluacion ? "a" : null, evaluacion });

  it("una revisada gana a un borrador posterior", () => {
    const vigentes = checksVigentes([
      deEvaluacion("2026-09-01T10:00:00Z", "CONFORME", { status: "CON_GAPS", reviewed_at: "2026-09-02T10:00:00Z" }),
      deEvaluacion("2026-09-10T10:00:00Z", "PENDIENTE", { status: "BORRADOR", reviewed_at: null }),
    ]);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].status, "el borrador posterior tapó la evaluación revisada").toBe("CONFORME");
  });

  it("el orden de llegada no cambia el resultado", () => {
    const vigentes = checksVigentes([
      deEvaluacion("2026-09-10T10:00:00Z", "PENDIENTE", { status: "BORRADOR", reviewed_at: null }),
      deEvaluacion("2026-09-01T10:00:00Z", "CONFORME", { status: "CON_GAPS", reviewed_at: "2026-09-02T10:00:00Z" }),
    ]);
    expect(vigentes[0].status).toBe("CONFORME");
  });

  it("control positivo: una evaluación cerrada posterior SÍ desplaza a la anterior", () => {
    // Sin esto, un filtro que congelara la primera comprobación para siempre
    // pasaría el caso de arriba.
    const vigentes = checksVigentes([
      deEvaluacion("2026-09-01T10:00:00Z", "CONFORME", { status: "CON_GAPS", reviewed_at: "2026-09-02T10:00:00Z" }),
      deEvaluacion("2026-09-10T10:00:00Z", "NO_CONFORME", { status: "CON_GAPS", reviewed_at: null }),
    ]);
    expect(vigentes[0].status).toBe("NO_CONFORME");
  });

  it("un borrador que es lo único que hay se conserva: no se pierde dato", () => {
    const vigentes = checksVigentes([
      deEvaluacion("2026-09-10T10:00:00Z", "PENDIENTE", { status: "BORRADOR", reviewed_at: null }),
    ]);
    expect(vigentes).toHaveLength(1);
  });

  it("las legacy (sin evaluación) siguen el criterio de siempre: manda la más reciente", () => {
    const vigentes = checksVigentes([
      deEvaluacion("2026-05-21T10:00:00Z", "NO_CONFORME", null),
      deEvaluacion("2026-07-19T10:00:00Z", "CONFORME", null),
    ]);
    expect(vigentes[0].status).toBe("CONFORME");
  });
});

describe("la lectura del módulo pasa por el filtro", () => {
  it("todo lector de ai_compliance_checks en src/hooks lo aplica", () => {
    // 2026-09-08 (revisión adversarial): el Board Pack leía el histórico entero
    // y multiplicaba las no conformidades por cada reevaluación. El gate
    // barría un solo fichero; ahora barre todos los hooks.
    const hooks = readdirSync("src/hooks").filter((f) => /\.ts$/.test(f)).map((f) => `src/hooks/${f}`);
    expect(hooks.length).toBeGreaterThan(10);
    const src = hooks.map((f) => readFileSync(f, "utf8")).join("\n");
    // Corregir sólo uno dejaría la consola contando duplicados por el otro
    // camino: es exactamente el patrón de «se arregla la pantalla que se está
    // mirando y la misma afirmación sobrevive por su hermana».
    // Sólo las LECTURAS: el alta de la misma tabla es un `.insert()` y no
    // tiene nada que deduplicar.
    const lecturas = (src.match(/from\("ai_compliance_checks"\)\s*\n\s*\.select\(/g) ?? []).length;
    const aplicaciones = (src.match(/checksVigentes\(/g) ?? []).length;
    expect(lecturas, "ya no hay lecturas de ai_compliance_checks: revisa este invariante").toBeGreaterThan(0);
    expect(aplicaciones, `${lecturas} lecturas y ${aplicaciones} aplicaciones`).toBeGreaterThanOrEqual(lecturas);
  });
});
