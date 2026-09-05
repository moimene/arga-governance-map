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
  /**
   * Dónde vive el dato cuando la tabla está vacía porque el tenant usa OTRA
   * superficie. Convierte una inferencia —«supongo que no usa esta tabla»— en
   * un invariante comprobable: si alguien migra el dato, la mitad de aquí baja
   * a cero y la declaración rompe. Sin esto, «vacía por procedencia» sería
   * indistinguible de «vacía porque se rompió el seed».
   */
  readonly alternativa?: {
    readonly tabla: string;
    readonly minimo: number;
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
    // Está en DOMAIN_TABLES del gate de aislamiento y su dirección
    // ARGA→Garrigues es vacua: el `console.warn` de ese fichero la venía
    // señalando sin asertarla.
    tabla: "document_templates",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "Este tenant no usa esta superficie: sus plantillas viven en " +
        "`plantillas_protegidas`, donde G3 dejó las 6 del núcleo en estado ACTIVA. La " +
        "ausencia aquí no es un seed roto, es que el dato está en otro sitio — y por eso se " +
        "declara con su alternativa, para que la afirmación sea comprobable y no una " +
        "suposición.",
      fuente: "G3, 6 plantillas núcleo del tenant (CLAUDE.md, sección Tenant Garrigues)",
    },
    alternativa: { tabla: "plantillas_protegidas", minimo: 1 },
    marcadores: {},
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
      fuente: "PPD-01 §4.2; decisión de la Tarea 5 del carril C3 (commit 22d0579)",
    },
    marcadores: {},
  },
  // ── Tablas añadidas por el carril CONSOLA (2026-09-05) ──────────────────
  // El read model de la consola pasó a leerlas tenant-scoped, así que entran
  // en el gate de aislamiento: una tabla que la consola cuenta y el gate no
  // vigila es exactamente el hueco por el que un número cruza de tenant.
  {
    tabla: "delegations",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {
      garrigues: ["GARR-DEL-2026-01", "GARR-DEL-EAD-CD"],
    },
  },
  {
    tabla: "notifications",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {},
  },
  {
    tabla: "condiciones_persona",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {},
  },
  {
    tabla: "incidents",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "El carril GRC de este tenant se sembró con el mapa de riesgos penales, los hallazgos " +
        "enlazados y los controles del PPD, pero NO con incidentes: el despacho no ha declarado " +
        "ninguno y fabricar incidentes verosímiles los haría indistinguibles de los reales. La " +
        "ausencia es la decisión, no un seed a medias.",
      fuente: "carril C3, seeds de Garrigues sin incidentes (commit 22d0579)",
    },
    marcadores: {},
  },
  {
    tabla: "evidence_bundles",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "Este tenant no ha producido todavía ningún artefacto documental propio (0 actas, 0 " +
        "certificaciones, 0 artefactos), así que no hay nada de lo que emitir bundle. Y el " +
        "backbone probatorio sigue en HOLD, de modo que tampoco se emitiría por conveniencia " +
        "de la demo: la ausencia es coherente con la postura declarada del carril de evidencia.",
      fuente: "migración 000049 en HOLD; informe de revisión 2026-09-02 §2.1 (commit 45809dd)",
    },
    marcadores: {},
  },
  {
    tabla: "governance_module_events",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "Los handoffs cross-module son read-only por navegación y ninguna superficie escribe en " +
        "esta tabla (0 inserts en src/). Las filas de ARGA son históricas. Que Garrigues tenga " +
        "cero no es un seed roto: es que el producto no emite eventos, y esa prohibición es " +
        "precisamente el contrato vigente.",
      fuente: "contrato read-only de src/lib/secretaria/cross-module-handoff.ts (commit 45809dd)",
    },
    marcadores: {},
  },
  {
    tabla: "governance_module_links",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "Mismo motivo que los eventos: la escritura en links está prohibida por el guardrail " +
        "vigente y ninguna superficie del producto la ejerce. Las tres filas de ARGA son " +
        "históricas y el tenant nuevo no puede generar ninguna sin romper ese contrato.",
      fuente: "contrato read-only de src/lib/secretaria/cross-module-handoff.ts (commit 45809dd)",
    },
    marcadores: {},
  },
] as const;

/** Las tablas cuya ausencia está declarada, para poder afirmarlo en el gate. */
export const CON_AUSENCIA_DECLARADA = AISLAMIENTO_DECLARADO.filter(
  (t) => t.arga === "NINGUNA" || t.garrigues === "NINGUNA",
);
