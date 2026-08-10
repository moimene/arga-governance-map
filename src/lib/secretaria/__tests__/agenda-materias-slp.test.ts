/**
 * G3 Task 4 — Materias SLP nuevas en el catálogo.
 *
 * Las 6 materias exigidas por los 12 puntos reales de la Junta de Socios 2026
 * de Garrigues. Clasificación RESUELTA por el Comité Legal el 2026-08-04
 * (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md).
 *
 * Criterio vinculante: NINGUNA de las 4 materias de socio (admisión,
 * exclusión, continuidad, retribución) es ESPECIAL. `matter_class='ESPECIAL'`
 * las excluiría de `filterAgreementCompatibleMaterias` y por tanto del
 * selector genérico de materias — una materia reservada del gate de informe
 * preceptivo (Task 7) que quedara fuera del circuito general produciría un
 * falso negativo silencioso: una Junta que acuerda sin que el sistema
 * pregunte nunca por el informe del órgano informante.
 *
 * Este test es unitario sobre el código (AGENDA_MATERIAS + el fichero de
 * migración leído como texto). No sondea Cloud — eso es explícitamente del
 * controller (Steps 4-5 del brief).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENDA_MATERIAS,
  MATERIA_ORGANOS,
  agendaMateriaGroups,
  filterMateriaRowsForTipoSocial,
  isMateriaCompatibleWithOrgano,
  isMateriaVisibleForTipoSocial,
  labelMateria,
} from "@/lib/secretaria/agenda-materias";
import { filterAgreementCompatibleMaterias } from "@/lib/secretaria/matter-class";

const MIGRATION_PATH = "supabase/migrations/20260804080000_g3_slp_materias.sql";

interface SlpMateriaExpectation {
  value: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
}

const SLP_MATERIAS_ESPERADAS: readonly SlpMateriaExpectation[] = [
  { value: "ADMISION_SOCIO_CUOTA", tipo: "ESTATUTARIA", inscribible: true },
  { value: "EXCLUSION_SOCIO_ESTATUTARIA", tipo: "ESTATUTARIA", inscribible: true },
  { value: "CONTINUIDAD_SOCIO_POST_60", tipo: "ESTATUTARIA", inscribible: false },
  // Fix round 1, contraorden sobre I-2: Estatutos reales art. 12.6 — acuerdo
  // anual de la Junta, no modificación estatutaria. NO inscribible.
  { value: "RETRIBUCION_PRESTACIONES_ACCESORIAS", tipo: "ESTATUTARIA", inscribible: false },
  { value: "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA", tipo: "ESTRUCTURAL", inscribible: true },
  { value: "NOMBRAMIENTO_ADMINISTRADOR_UNICO", tipo: "ORDINARIA", inscribible: true },
];

const SOCIO_MATERIAS = [
  "ADMISION_SOCIO_CUOTA",
  "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60",
  "RETRIBUCION_PRESTACIONES_ACCESORIAS",
];

const migration = readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8");
const executableSql = migration.replace(/^\s*--.*$/gm, "");
// Sólo la sección VALUES(...) del INSERT: el bloque DO $assert$ legítimamente
// contiene el literal 'ESPECIAL' dentro de su propia comprobación negativa
// (verifica que NINGUNA fila lo use), así que un grep sobre el fichero
// completo daría un falso positivo. Acotar a las filas reales de datos.
const valuesSection = executableSql.slice(
  executableSql.indexOf("VALUES"),
  executableSql.indexOf("ON CONFLICT (materia)"),
);

/** Coincide con la fila VALUES completa en el orden de columnas de la
 * migración: materia, materia_label_es, requires_notary, requires_registry,
 * inscribable, matter_class. Ancla `inscribible` a su posición real (3ª
 * columna booleana) para no confundirla con cualquier otro booleano de la fila. */
function rowPattern(value: string, tipo: string, inscribible: boolean): RegExp {
  const bool = "(?:true|false)";
  return new RegExp(
    `'${value}'\\s*,\\s*'[^']*'\\s*,\\s*${bool}\\s*,\\s*${bool}\\s*,\\s*(${inscribible})\\s*,\\s*'${tipo}'`,
  );
}

describe("agenda-materias — SLP (G3 Task 4, 12 puntos Junta de Socios 2026)", () => {
  it("AGENDA_MATERIAS contiene las 6 materias SLP con tipo e inscribible correctos", () => {
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      const materia = AGENDA_MATERIAS.find((m) => m.value === esperado.value);
      expect(materia, `falta ${esperado.value} en AGENDA_MATERIAS`).toBeDefined();
      expect(materia).toMatchObject({
        tipo: esperado.tipo,
        inscribible: esperado.inscribible,
      });
    }
  });

  it("criterio vinculante: las 4 materias de socio son ESTATUTARIA (nunca ESPECIAL)", () => {
    for (const socio of SOCIO_MATERIAS) {
      const materia = AGENDA_MATERIAS.find((m) => m.value === socio);
      expect(materia?.tipo).toBe("ESTATUTARIA");
    }
  });

  it("las 4 materias de socio pasan filterAgreementCompatibleMaterias y permanecen en el selector genérico", () => {
    const rows = SLP_MATERIAS_ESPERADAS.map((m) => ({ materia: m.value, matter_class: m.tipo }));
    const compatibles = filterAgreementCompatibleMaterias(rows).map((r) => r.materia);
    for (const socio of SOCIO_MATERIAS) {
      expect(compatibles).toContain(socio);
    }
    // Las 6 (ninguna ESPECIAL) deben sobrevivir al filtro, no solo las 4 de socio.
    expect(compatibles.sort()).toEqual(SLP_MATERIAS_ESPERADAS.map((m) => m.value).sort());
  });

  it("las 6 materias son propias de la Junta de Socios (JUNTA_GENERAL en el motor) y no del Consejo", () => {
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      expect(MATERIA_ORGANOS[esperado.value]).toEqual(["JUNTA_GENERAL"]);
      expect(isMateriaCompatibleWithOrgano(esperado.value, "JUNTA_GENERAL")).toBe(true);
      expect(isMateriaCompatibleWithOrgano(esperado.value, "CONSEJO")).toBe(false);
      expect(isMateriaCompatibleWithOrgano(esperado.value, "COMISION_DELEGADA")).toBe(false);
    }
  });

  it("la nueva ESTRUCTURAL respeta la exclusividad de Junta General (invariante ya cubierta en agenda-materias.test.ts)", () => {
    const estructurales = AGENDA_MATERIAS.filter((m) => m.tipo === "ESTRUCTURAL").map((m) => m.value);
    expect(estructurales).toContain("INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA");
    for (const value of estructurales) {
      expect(MATERIA_ORGANOS[value]).toEqual(["JUNTA_GENERAL"]);
    }
  });

  it("con tipoSocial SLP, las 6 aparecen en el grupo 'propias' de la Junta y no filtran hacia otros órganos", () => {
    const propiasJunta = agendaMateriaGroups("JUNTA_GENERAL", "SLP").find((g) => g.key === "propias")!;
    const valoresPropios = propiasJunta.materias.map((m) => m.value);
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      expect(valoresPropios).toContain(esperado.value);
    }
    // Con tipoSocial SLP (pasa el gate I-1), el filtro de órgano sigue
    // excluyendo Consejo/Comisión — las 6 son JUNTA_ONLY independientemente.
    const groupsConsejo = agendaMateriaGroups("CONSEJO", "SLP").flatMap((g) => g.materias.map((m) => m.value));
    const groupsComision = agendaMateriaGroups("COMISION_DELEGADA", "SLP").flatMap((g) => g.materias.map((m) => m.value));
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      expect(groupsConsejo).not.toContain(esperado.value);
      expect(groupsComision).not.toContain(esperado.value);
    }
  });

  it("las 6 declaran soloTipoSocial: ['SLP'] en AGENDA_MATERIAS", () => {
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      const materia = AGENDA_MATERIAS.find((m) => m.value === esperado.value);
      expect(materia?.soloTipoSocial).toEqual(["SLP"]);
    }
  });

  describe("fix round 1, I-1 — gate fail-closed por tipoSocial (agendaMateriaGroups)", () => {
    const genericas = ["APROBACION_CUENTAS", "MODIFICACION_ESTATUTOS", "NOMBRAMIENTO_CONSEJERO"];
    const slpValues = SLP_MATERIAS_ESPERADAS.map((m) => m.value);
    const valuesFor = (tipoSocial?: "SA" | "SL" | "SLU" | "SAU" | "SLP") =>
      agendaMateriaGroups("JUNTA_GENERAL", tipoSocial).flatMap((g) => g.materias.map((m) => m.value));

    it("con tipoSocial SA (ARGA) las 6 materias SLP NO aparecen — el error letal en espejo", () => {
      const values = valuesFor("SA");
      for (const value of slpValues) {
        expect(values).not.toContain(value);
      }
    });

    it("con tipoSocial SLP las 6 materias SÍ aparecen", () => {
      const values = valuesFor("SLP");
      for (const value of slpValues) {
        expect(values).toContain(value);
      }
    });

    it("sin tipoSocial conocido (undefined) las 6 quedan fuera — fail-closed", () => {
      const values = valuesFor(undefined);
      for (const value of slpValues) {
        expect(values).not.toContain(value);
      }
    });

    it("las materias genéricas (sin soloTipoSocial) son idénticas con SA, con SLP y sin tipoSocial", () => {
      const withSA = valuesFor("SA").filter((v) => !slpValues.includes(v)).sort();
      const withSLP = valuesFor("SLP").filter((v) => !slpValues.includes(v)).sort();
      const withoutTipoSocial = valuesFor(undefined).filter((v) => !slpValues.includes(v)).sort();
      expect(withSA).toEqual(withoutTipoSocial);
      expect(withSLP).toEqual(withoutTipoSocial);
      for (const materia of genericas) {
        expect(withSA).toContain(materia);
        expect(withSLP).toContain(materia);
        expect(withoutTipoSocial).toContain(materia);
      }
    });

    it("isMateriaVisibleForTipoSocial: fail-closed unitario", () => {
      const restringida = { soloTipoSocial: ["SLP"] as const };
      const generica = { soloTipoSocial: undefined };
      expect(isMateriaVisibleForTipoSocial(restringida, "SLP")).toBe(true);
      expect(isMateriaVisibleForTipoSocial(restringida, "SA")).toBe(false);
      expect(isMateriaVisibleForTipoSocial(restringida, undefined)).toBe(false);
      expect(isMateriaVisibleForTipoSocial(generica, "SA")).toBe(true);
      expect(isMateriaVisibleForTipoSocial(generica, undefined)).toBe(true);
    });
  });

  describe("review final G3 I-1 — filterMateriaRowsForTipoSocial (fuente única para los consumidores que leen materia_catalog directamente: CatalogoMaterias y DecisionUnipersonalStepper)", () => {
    const catalogRows = () => [
      { materia: "APROBACION_CUENTAS" },
      ...SLP_MATERIAS_ESPERADAS.map((m) => ({ materia: m.value })),
    ];

    it("con tipoSocial SA (ARGA) las 6 materias SLP quedan fuera del catálogo BD; las genéricas permanecen", () => {
      const filtered = filterMateriaRowsForTipoSocial(catalogRows(), "SA").map((r) => r.materia);
      expect(filtered).toContain("APROBACION_CUENTAS");
      for (const value of SLP_MATERIAS_ESPERADAS.map((m) => m.value)) {
        expect(filtered).not.toContain(value);
      }
    });

    it("con tipoSocial SLP las 6 materias SÍ aparecen en el catálogo BD", () => {
      const filtered = filterMateriaRowsForTipoSocial(catalogRows(), "SLP").map((r) => r.materia);
      expect(filtered).toContain("APROBACION_CUENTAS");
      for (const value of SLP_MATERIAS_ESPERADAS.map((m) => m.value)) {
        expect(filtered).toContain(value);
      }
    });

    it("sin tipoSocial conocido (undefined/null) las 6 quedan fuera — fail-closed, mismo criterio que agendaMateriaGroups", () => {
      const withoutTipoSocial = filterMateriaRowsForTipoSocial(catalogRows(), undefined).map((r) => r.materia);
      const withNull = filterMateriaRowsForTipoSocial(catalogRows(), null).map((r) => r.materia);
      for (const value of SLP_MATERIAS_ESPERADAS.map((m) => m.value)) {
        expect(withoutTipoSocial).not.toContain(value);
        expect(withNull).not.toContain(value);
      }
    });

    it("un código sin entrada en AGENDA_MATERIAS (materia solo de materia_catalog, p.ej. PACTO_PARASOCIAL) no está restringido y sobrevive con cualquier tipoSocial", () => {
      const rows = [{ materia: "PACTO_PARASOCIAL" }];
      expect(filterMateriaRowsForTipoSocial(rows, "SA").map((r) => r.materia)).toEqual(["PACTO_PARASOCIAL"]);
      expect(filterMateriaRowsForTipoSocial(rows, undefined).map((r) => r.materia)).toEqual(["PACTO_PARASOCIAL"]);
    });
  });

  it("las 6 tienen etiqueta jurídica en castellano (labelMateria no exhibe el código crudo)", () => {
    for (const esperado of SLP_MATERIAS_ESPERADAS) {
      const label = labelMateria(esperado.value);
      expect(label).not.toBe(esperado.value);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it("NOMBRAMIENTO_ADMINISTRADOR_UNICO es una identidad nueva, no colisiona con nombramientos existentes", () => {
    const existentes = ["NOMBRAMIENTO_CONSEJERO", "NOMBRAMIENTO_AUDITOR", "CESE_CONSEJERO", "NOMBRAMIENTO_REPRESENTANTE_FILIAL"];
    const nombramiento = AGENDA_MATERIAS.find((m) => m.value === "NOMBRAMIENTO_ADMINISTRADOR_UNICO");
    expect(nombramiento).toBeDefined();
    expect(existentes).not.toContain(nombramiento?.value);
  });

  describe("migración materia_catalog (fuente de verdad para Cloud)", () => {
    it("inserta las 6 materias idempotentemente vía ON CONFLICT DO UPDATE", () => {
      expect(executableSql).toContain("INSERT INTO public.materia_catalog");
      expect(executableSql).toContain("ON CONFLICT (materia) DO UPDATE SET");
      for (const esperado of SLP_MATERIAS_ESPERADAS) {
        expect(executableSql).toContain(`'${esperado.value}'`);
      }
    });

    it("declara exactamente 6 filas VALUES (sin duplicados ni huecos)", () => {
      const rowStarts = valuesSection.match(/^\s*\('[A-Z0-9_]+',/gm) ?? [];
      expect(rowStarts.length).toBe(6);
    });

    it("cada fila declara tipo e inscribible coherentes con AGENDA_MATERIAS (misma línea, mismo orden de columnas)", () => {
      for (const esperado of SLP_MATERIAS_ESPERADAS) {
        expect(executableSql).toMatch(rowPattern(esperado.value, esperado.tipo, esperado.inscribible));
      }
    });

    it("criterio vinculante a nivel Cloud: ninguna fila de datos usa matter_class='ESPECIAL'", () => {
      expect(valuesSection).not.toMatch(/'ESPECIAL'/);
    });

    it("fix round 1, contraorden I-2: RETRIBUCION_PRESTACIONES_ACCESORIAS NO inscribible (art. 12.6 Estatutos: acuerdo anual de la Junta, no modificación estatutaria)", () => {
      expect(valuesSection).toMatch(
        /'RETRIBUCION_PRESTACIONES_ACCESORIAS'\s*,\s*'[^']*'\s*,\s*false\s*,\s*false\s*,\s*false\s*,\s*'ESTATUTARIA'/,
      );
    });

    it("referencia_legal cita los Estatutos reales aportados por el usuario", () => {
      expect(valuesSection).toContain("arts. 9.2, 30.3.b) y 39.5.b) Estatutos (mayoría 80%); arts. 13 y 8 Ley 2/2007");
      expect(valuesSection).toContain("arts. 10.7, 12 y 30.2.j) Estatutos; art. 89 LSC");
    });

    it("el bloque de autocomprobación SÍ verifica activamente la ausencia de ESPECIAL (no es un check vacío)", () => {
      const assertBlock = executableSql.slice(executableSql.indexOf("DO $assert$"));
      expect(assertBlock).toMatch(/matter_class\s*=\s*'ESPECIAL'/);
      expect(assertBlock).toMatch(/v_especial\s*<>\s*0/);
    });

    it("incorpora una autocomprobación transaccional fail-closed", () => {
      expect(executableSql).toContain("BEGIN;");
      expect(executableSql).toContain("DO $assert$");
      expect(executableSql).toContain("COMMIT;");
      expect(executableSql).toMatch(/RAISE EXCEPTION/);
    });
  });
});
