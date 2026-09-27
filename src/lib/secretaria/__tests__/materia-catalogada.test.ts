import { describe, expect, it } from "vitest";
import {
  esMateriaCatalogada,
  filtrarMateriasCatalogadas,
  materiaCatalogCodigos,
  notaMateriasPendientes,
} from "@/lib/secretaria/materia-catalogada";
import { AGENDA_MATERIAS } from "@/lib/secretaria/agenda-materias";

// H-50 (MOI-15, severidad A): el asistente de convocatoria y otros
// selectores ofrecían 14 materias DECISORIAS sin fila en `materia_catalog`
// (APROBACION_PLAN_NEGOCIO, FINANCIACION, CONTRATACION_RELEVANTE,
// COMITES_INTERNOS, POLITICAS_CORPORATIVAS, RATIFICACION_ACTOS,
// SEGUROS_RESPONSABILIDAD, DISTRIBUCION_RESERVAS, REELECCION_CONSEJERO,
// PROGRAMA_RECOMPRA, MODIFICACION_REGLAMENTO, CESION_GLOBAL,
// AUTORIZACION_OPERACION_ESTRUCTURAL, OTROS_LIBRE): con cualquiera se emite
// la convocatoria, pero el acta la rechaza en servidor. Medido en Cloud
// (governance_OS) el 2026-09-27: las 14 no tienen fila en materia_catalog.
const CATALOGO_VACIO_MEDIDO_H50 = [
  "APROBACION_PLAN_NEGOCIO",
  "FINANCIACION",
  "CONTRATACION_RELEVANTE",
  "COMITES_INTERNOS",
  "POLITICAS_CORPORATIVAS",
  "RATIFICACION_ACTOS",
  "SEGUROS_RESPONSABILIDAD",
  "DISTRIBUCION_RESERVAS",
  "REELECCION_CONSEJERO",
  "PROGRAMA_RECOMPRA",
  "MODIFICACION_REGLAMENTO",
  "CESION_GLOBAL",
  "AUTORIZACION_OPERACION_ESTRUCTURAL",
  "OTROS_LIBRE",
];

// Revisión P2 (MOI-15, ola 5): el informe original solo declaraba el impacto
// medido en ARGA (…0001, 11 filas de `agreements`) y Garrigues (…0002, 0
// filas). Existe un tercer tenant real con dato en estas materias sin
// catálogo: `agreements` tiene 2 filas de APROBACION_PLAN_NEGOCIO en
// `00000000-0000-0000-0000-000000000003` (Grupo Nuevo / tenant-cero),
// verificado por SELECT en Cloud (governance_OS) el 2026-09-27. El fix ya es
// genérico por catálogo, no por tenant, así que no requiere cambio de
// código — solo declarar el impacto que faltaba en el informe.

describe("materia-catalogada — criterio único de H-50", () => {
  it("fail-closed: sin catálogo (null) ninguna materia se considera catalogada", () => {
    for (const materia of ["APROBACION_CUENTAS", "OTROS_LIBRE", "CUALQUIER_COSA"]) {
      expect(esMateriaCatalogada(materia, null)).toBe(false);
    }
  });

  it("reconoce las materias que sí tienen fila en el Set de códigos", () => {
    const codigos = new Set(["APROBACION_CUENTAS", "AUMENTO_CAPITAL"]);
    expect(esMateriaCatalogada("APROBACION_CUENTAS", codigos)).toBe(true);
    expect(esMateriaCatalogada("AUMENTO_CAPITAL", codigos)).toBe(true);
    expect(esMateriaCatalogada("OTROS_LIBRE", codigos)).toBe(false);
  });

  it("las 14 materias medidas en Cloud sin fila en materia_catalog (2026-09-27) quedan fuera con el catálogo real conocido", () => {
    // Simula el catálogo real: todas las materias de AGENDA_MATERIAS EXCEPTO
    // las 14 medidas como huecas en Cloud.
    const codigosReales = new Set(
      AGENDA_MATERIAS.map((m) => m.value).filter((v) => !CATALOGO_VACIO_MEDIDO_H50.includes(v)),
    );
    for (const materia of CATALOGO_VACIO_MEDIDO_H50) {
      expect(esMateriaCatalogada(materia, codigosReales)).toBe(false);
    }
    // Control positivo: una materia sí catalogada (medida en Cloud, 2026-09-27).
    expect(esMateriaCatalogada("APROBACION_CUENTAS", codigosReales)).toBe(true);
  });

  describe("materiaCatalogCodigos", () => {
    it("es null mientras carga, en error, o sin filas — nunca un Set vacío que se confunda con 'cero pendientes'", () => {
      expect(materiaCatalogCodigos([{ materia: "X" }], { isLoading: true })).toBeNull();
      expect(materiaCatalogCodigos([{ materia: "X" }], { isError: true })).toBeNull();
      expect(materiaCatalogCodigos(undefined)).toBeNull();
    });

    it("construye el Set de materia_catalog cuando ya resolvió", () => {
      const codigos = materiaCatalogCodigos([{ materia: "A" }, { materia: "B" }]);
      expect(codigos).toEqual(new Set(["A", "B"]));
    });
  });

  describe("filtrarMateriasCatalogadas", () => {
    it("particiona exhaustiva y disjuntamente catalogadas vs pendientes", () => {
      const materias = [{ value: "A" }, { value: "B" }, { value: "C" }];
      const { catalogadas, pendientes } = filtrarMateriasCatalogadas(materias, new Set(["A", "C"]));
      expect(catalogadas.map((m) => m.value)).toEqual(["A", "C"]);
      expect(pendientes.map((m) => m.value)).toEqual(["B"]);
    });

    it("con catálogo null, todo queda pendiente (fail-closed)", () => {
      const materias = [{ value: "A" }, { value: "B" }];
      const { catalogadas, pendientes } = filtrarMateriasCatalogadas(materias, null);
      expect(catalogadas).toEqual([]);
      expect(pendientes).toHaveLength(2);
    });
  });

  describe("notaMateriasPendientes", () => {
    it("es null sin pendientes, nunca las hace desaparecer en silencio en caso contrario", () => {
      expect(notaMateriasPendientes(0)).toBeNull();
      expect(notaMateriasPendientes(1)).toBe("1 materia pendiente de clasificación jurídica");
      expect(notaMateriasPendientes(14)).toBe("14 materias pendientes de clasificación jurídica");
    });
  });
});
