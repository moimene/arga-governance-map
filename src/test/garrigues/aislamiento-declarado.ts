// src/test/garrigues/aislamiento-declarado.ts
//
// Qué se espera encontrar en cada tabla, por tenant, y POR QUÉ.
//
// Existe porque «no hay filas» tiene dos causas que se ven idénticas y no lo
// son:
//
//   - **Vacía por defecto**: el seed falló, la migración no entró, RLS las
//     tapa. Un gate que la tolera es un gate roto.
//   - **Vacía por procedencia**: la fuente no publica esos datos. Un gate que
//     la rompe empuja a fabricarlos para que calle — que es exactamente lo que
//     la decisión de no fabricarlos quería impedir.
//
// La declaración va como DATO y no como comentario a propósito. Un motivo en
// un comentario lo borra quien se encuentre el gate rojo dentro de tres
// semanas; un motivo que el test recorre le obliga a decidir conscientemente
// qué está cambiando.
//
// Y no es una exención: es un estado pinado. Si `action_plans` de Garrigues
// deja de estar vacía, la declaración deja de cuadrar y el gate **también
// rompe**. No se silencia la vacuidad — se le pone dueño.

export const ARGA = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES = "00000000-0000-0000-0000-000000000002";

/** Qué se espera del conteo de un tenant en una tabla. */
export type Presencia = "ALGUNA" | "NINGUNA";

export type TablaDeclarada = {
  readonly tabla: string;
  readonly arga: Presencia;
  readonly garrigues: Presencia;
  /**
   * Obligatorio en cuanto alguno de los dos sea `NINGUNA`. Y con FUENTE: un
   * «a propósito» sin referencia es indistinguible del «a propósito» de quien
   * quería que el gate callara.
   */
  readonly motivo?: {
    readonly texto: string;
    readonly fuente: string;
  };
  /**
   * Identificadores que SOLO pueden existir en ese tenant. La invariante de
   * aislamiento se escribe a mano con ellos, no derivando dos conjuntos con la
   * misma consulta: eso probaría que la consulta es determinista, no que haya
   * aislamiento.
   */
  readonly marcadores: {
    readonly arga?: readonly string[];
    readonly garrigues?: readonly string[];
  };
};

export const AISLAMIENTO_DECLARADO: readonly TablaDeclarada[] = [
  {
    tabla: "conflicts_of_interest",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {
      garrigues: ["COI-GARR-01", "COI-GARR-02", "COI-GARR-03", "COI-GARR-04", "COI-GARR-05"],
    },
  },
  {
    tabla: "findings",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {
      garrigues: ["FND-GARR-PEN-010-IP", "FND-GARR-PEN-069-FISCAL"],
    },
  },
  {
    tabla: "risks",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {
      garrigues: ["RSK-GARR-PEN-010", "RSK-GARR-PEN-069"],
    },
  },
  {
    tabla: "action_plans",
    arga: "ALGUNA",
    // NINGUNA, y no es un fallo de siembra.
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "El Manual del Sistema de Gestión de Riesgos Penales describe el mecanismo del Plan de " +
        "acción y no publica los planes concretos. Sembrar planes verosímiles los haría " +
        "indistinguibles de los reales, así que la decisión del carril fue no sembrar ninguno y " +
        "explicar la ausencia en pantalla.",
      fuente: "PPD-01 §246; decisión de la Tarea 5 del carril C3 (commit 22d0579)",
    },
    marcadores: {},
  },
] as const;

/** Las tablas cuya ausencia está declarada, para poder afirmarlo en el gate. */
export const CON_AUSENCIA_DECLARADA = AISLAMIENTO_DECLARADO.filter(
  (t) => t.arga === "NINGUNA" || t.garrigues === "NINGUNA",
);
