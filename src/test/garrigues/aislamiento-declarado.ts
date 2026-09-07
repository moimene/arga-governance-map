// src/test/garrigues/aislamiento-declarado.ts
//
// Qué se espera encontrar en cada tabla, por tenant, y POR QUÉ.
//
// ─── CAMBIO DE ORDEN, 2026-09-07 ────────────────────────────────────────────
//
// Este fichero nació bajo una orden que ya NO rige: «Garrigues no tiene
// inventario propio y no se siembra, porque fabricar esos datos haría el dato
// demo indistinguible del real; la ausencia ES la decisión». La orden vigente
// es la contraria: el tenant SE VA A IR SEMBRANDO, de forma progresiva, con
// dato simulado pero basado en la realidad, y ese dato DEBE PERSISTIR.
//
// Eso invierte lo que hay que vigilar, sin aflojarlo:
//
//   - Antes: «sigue vacío» era la invariante, y sembrar una fila ponía el gate
//     ROJO. Un gate así empuja al siguiente a revertir la siembra para callarlo.
//   - Ahora: la invariante es «no se ha perdido lo que había». Sembrar es
//     VERDE; borrar dato sembrado es ROJO.
//
// Lo que NO cambia, y era el motivo real de este fichero: una aserción de
// aislamiento no puede pasar POR CONJUNTO VACÍO. Si Garrigues no tiene filas,
// «Garrigues no ve las de ARGA» no prueba nada. Ese verde vacío sigue siendo el
// vicio contra el que se escribió todo esto — y por eso la vacuidad no se
// tolera: se cuenta, con un techo (ver `VACUIDAD_MAXIMA`).

export const ARGA = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES = "00000000-0000-0000-0000-000000000002";

/**
 * Qué se espera del conteo de un tenant en una tabla.
 *
 *   - `ALGUNA`   — hay filas y TIENEN QUE SEGUIR HABIÉNDOLAS. Si se vacía, ROJO.
 *                  Es la persistencia: dato sembrado que desaparece es un
 *                  defecto, no una limpieza.
 *   - `PENDIENTE`— aún sin sembrar, se sembrará. Con filas o sin ellas NO rompe,
 *                  de modo que avanzar la siembra nunca pone la corrida en rojo.
 *                  Su vacuidad la vigila el trinquete, no esta declaración.
 *   - `NINGUNA`  — ausencia que es DECISIÓN PERMANENTE, no un paso pendiente.
 *                  Exige motivo Y fuente, y si aparecen filas, ROJO: la decisión
 *                  se habrá revertido sin decirlo.
 *
 * `PENDIENTE` no es una exención disfrazada. Degradar una entrada de `ALGUNA` a
 * `PENDIENTE` para callar un rojo NO funciona: el trinquete de abajo cuenta
 * sobre el DATO MEDIDO, no sobre esta declaración, así que el número no se
 * mueve y el techo sigue roto.
 */
export type Presencia = "ALGUNA" | "PENDIENTE" | "NINGUNA";

export type TablaDeclarada = {
  readonly tabla: string;
  readonly arga: Presencia;
  readonly garrigues: Presencia;
  /**
   * Obligatorio en cuanto alguno de los dos sea `NINGUNA`, y PROHIBIDO en
   * cualquier otro caso — un motivo colgando de una tabla que no declara
   * ausencia permanente es una excusa preparada para cuando haga falta.
   *
   * Y con FUENTE: un «a propósito» sin referencia es indistinguible del «a
   * propósito» de quien quería que el gate callara.
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

/**
 * Las tablas del backbone de IA que tienen dato de ARGA.
 *
 * Solo estas entran en el gate: en ellas la dirección de riesgo real
 * —«Garrigues no ve las filas de ARGA»— asierta de verdad, porque hay filas que
 * ver. Las otras diecisiete tablas `ai_…` / `aims_…` están vacías en LOS DOS
 * tenants, así que vigilarlas sería teatro: dos direcciones vacuas y ninguna
 * información.
 *
 * `ai_systems` SALIÓ de esta lista el 2026-09-07: Garrigues ya tiene inventario
 * propio y su aislamiento se asierta entero, en las dos direcciones.
 */
export const TABLAS_IA_CON_DATO_ARGA = [
  "ai_incidents",
  "aims_system_versions",
  "aims_technical_file_sections",
  "aims_requirement_catalog",
  "aims_requirement_checks",
  "aims_control_catalog",
  "aims_monitoring_indicators",
  "aims_post_market_plans",
] as const;

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
    // Garrigues tiene inventario de IA propio desde el 2026-09-07 (medido en
    // Cloud: ARGA 8 filas, Garrigues 1). Su aislamiento dejó de ser vacuo.
    tabla: "ai_systems",
    arga: "ALGUNA",
    garrigues: "ALGUNA",
    marcadores: {},
  },

  // ── AUSENCIAS PERMANENTES (`NINGUNA`) ───────────────────────────────────
  // Solo tres, y ninguna es la orden vieja: no son «todavía no se ha sembrado»
  // sino «este tenant no puede tener filas aquí sin romper otra cosa».
  {
    tabla: "document_templates",
    arga: "ALGUNA",
    garrigues: "NINGUNA",
    motivo: {
      texto:
        "Este tenant no usa esta superficie: sus plantillas viven en " +
        "`plantillas_protegidas`, donde G3 dejó las 6 del núcleo en estado ACTIVA. La " +
        "ausencia aquí no es un seed roto ni un paso pendiente, es que el dato está en otro " +
        "sitio — y por eso se declara con su alternativa, para que la afirmación sea " +
        "comprobable y no una suposición.",
      fuente: "G3, 6 plantillas núcleo del tenant (CLAUDE.md, sección Tenant Garrigues)",
    },
    alternativa: { tabla: "plantillas_protegidas", minimo: 1 },
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
        "cero no es un paso pendiente de la siembra: es que el producto TIENE PROHIBIDO emitir " +
        "eventos, y sembrarlos rompería el guardrail vigente.",
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
        "históricas y el tenant nuevo no puede generar ninguna sin romper ese contrato, así " +
        "que esta ausencia no la resuelve ninguna siembra futura.",
      fuente: "contrato read-only de src/lib/secretaria/cross-module-handoff.ts (commit 45809dd)",
    },
    marcadores: {},
  },

  // ── PENDIENTES DE SIEMBRA (`PENDIENTE`) ─────────────────────────────────
  // Aquí vivía la orden vieja: cada una de estas entradas llevaba un motivo
  // que decía «fabricar dato verosímil lo haría indistinguible del real, la
  // ausencia es la decisión». Ya no. Se sembrarán, y cuando lo hagan este
  // fichero no debe ponerse rojo — solo el trinquete se mueve, hacia abajo.
  //
  // Los motivos se han RETIRADO, no reescritos: describían una decisión
  // derogada, y dejarlos aquí como prosa desactualizada es peor que no tener
  // nada. Lo que queda es el estado, que la máquina comprueba.
  //
  // La prueba de que esto no es teoría: `ai_systems` estuvo en este grupo hasta
  // hoy, alguien sembró una fila, y bajo la regla anterior el gate se puso rojo
  // por haber PROGRESADO.
  {
    // El PPD describe el mecanismo del plan de acción; los planes concretos aún
    // no se han sembrado.
    tabla: "action_plans",
    arga: "ALGUNA",
    garrigues: "PENDIENTE",
    marcadores: {},
  },
  {
    // El carril GRC sembró riesgos penales, hallazgos y controles del PPD; los
    // incidentes van después.
    tabla: "incidents",
    arga: "ALGUNA",
    garrigues: "PENDIENTE",
    marcadores: {},
  },
  {
    // Depende de que el tenant produzca artefactos: sin acta ni certificación
    // no hay de qué emitir bundle. Se sembrará detrás de `minutes`.
    tabla: "evidence_bundles",
    arga: "ALGUNA",
    garrigues: "PENDIENTE",
    marcadores: {},
  },
  // Backbone de IA. Medido en Cloud el 2026-09-07: Garrigues tiene 0 filas en
  // estas ocho. `ai_systems` ya no está aquí — se sembró, y es el precedente.
  ...TABLAS_IA_CON_DATO_ARGA.map((tabla) => ({
    tabla,
    arga: "ALGUNA" as const,
    garrigues: "PENDIENTE" as const,
    marcadores: {},
  })),
  // Secretaría. Entran aquí —y no solo en el smoke del carril— para que su
  // vacuidad la cuente el MISMO trinquete que la de todas las demás: un ledger,
  // un techo. Garrigues tiene 1 reunión y 0 actas; el día que cierre una, estas
  // dos bajan el conteo solas, sin que nadie edite una lista.
  {
    tabla: "minutes",
    arga: "ALGUNA",
    garrigues: "PENDIENTE",
    marcadores: {},
  },
  {
    tabla: "certifications",
    arga: "ALGUNA",
    garrigues: "PENDIENTE",
    marcadores: {},
  },
] as const;

/** Las tablas cuya ausencia se declara PERMANENTE, para poder exigirles motivo. */
export const CON_AUSENCIA_DECLARADA = AISLAMIENTO_DECLARADO.filter(
  (t) => t.arga === "NINGUNA" || t.garrigues === "NINGUNA",
);

/** Presencia medida en Cloud: cuántas filas propias ve cada tenant. */
export type Conteo = { readonly arga: number; readonly garrigues: number };

/**
 * Las direcciones de aislamiento que hoy NO prueban nada, calculadas del dato.
 *
 * «X no ve filas de Y en T» es vacua cuando Y no tiene filas en T: se filtra un
 * conjunto vacío y sale vacío. Se devuelven etiquetadas para que un rojo diga
 * exactamente qué mitad se quedó sin sujeto.
 */
export function direccionesVacuas(medido: ReadonlyMap<string, Conteo>): string[] {
  const vacuas: string[] = [];
  for (const t of AISLAMIENTO_DECLARADO) {
    const c = medido.get(t.tabla);
    if (!c) throw new Error(`${t.tabla}: sin medir. El conteo de vacuidad no sería válido.`);
    if (c.garrigues === 0) vacuas.push(`ARGA no ve filas Garrigues en ${t.tabla}`);
    if (c.arga === 0) vacuas.push(`Garrigues no ve filas ARGA en ${t.tabla}`);
  }
  return vacuas;
}

/**
 * EL TRINQUETE. Cuántas direcciones vacuas se toleran, como techo commiteado.
 *
 * Por qué un número y no una lista: porque el número se calcula del DATO MEDIDO
 * (`direccionesVacuas`), no de la declaración de arriba. Eso es lo que lo hace
 * fuerte —y es la propiedad que hay que preservar si alguien lo reescribe—:
 *
 *   - Sembrar una tabla que estaba vacía BAJA el conteo. 16 → 15 ≤ 16: verde.
 *     Progresar nunca pone la corrida en rojo, que es el requisito de la orden
 *     nueva.
 *   - Borrar dato sembrado lo SUBE por encima del techo: ROJO. Ahí está la
 *     persistencia, y no depende de que nadie se acuerde de nada.
 *   - Degradar una entrada de `ALGUNA` a `PENDIENTE` para callar ese rojo NO
 *     sirve: el conteo mide filas, no etiquetas. El techo sigue roto.
 *   - Añadir una tabla nueva con una dirección vacua también lo sube, y toca
 *     subir el techo A MANO, con su medición al lado. Eso es deliberado: una
 *     aserción vacua más es una decisión, no un descuido.
 *
 * Bajar este número cuando la siembra avance es OPCIONAL y bienvenido; lo que
 * no vale es subirlo sin haber medido.
 *
 * Medido en `governance_OS` el 2026-09-07 sobre las 23 tablas declaradas: 16
 * direcciones vacuas, todas del lado Garrigues (las 3 ausencias permanentes +
 * las 13 pendientes de siembra). Ninguna del lado ARGA: ARGA tiene filas en las
 * 23.
 */
export const VACUIDAD_MAXIMA = 16;
