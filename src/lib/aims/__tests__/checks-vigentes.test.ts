import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
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

describe("la lectura del módulo pasa por el filtro", () => {
  it("los dos hooks de comprobaciones lo aplican", () => {
    const src = readFileSync("src/hooks/useAiAssessments.ts", "utf8");
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
