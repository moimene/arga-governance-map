/**
 * Contrato de frontera entre AIMS, GRC Compass y Secretaría Societaria para el
 * RIA (F5.T2, MOI-175). Módulo HOJA: solo datos y funciones puras, sin
 * `node:fs` ni React, para que el escáner de migraciones
 * (`src/test/aims/frontera-modulos.test.ts`) y cualquier pantalla puedan
 * importarlo sin arrastrar nada del entorno de test.
 *
 * Detalle narrativo del contrato (C-01 a C-08):
 * `docs/superpowers/specs/2026-09-28-contrato-aims-grc-secretaria-ria.md`.
 *
 * LA REGLA (C-05): una función `fn_<modulo>_*` no escribe (INSERT/UPDATE/
 * DELETE) en una tabla de OTRO módulo salvo que su nombre conste en
 * `HANDOFFS_DECLARADOS` para ese módulo destino. Una tabla sin dueño (`tenants`,
 * `persons`, `entities`, `governing_bodies`, `policies`, `condiciones_persona`,
 * …) es núcleo compartido y no entra en la comprobación.
 */

export type Modulo = "aims" | "grc" | "secretaria";

/**
 * Tablas cuyo nombre exacto pertenece a un módulo. Los prefijos `aims_`,
 * `grc_` y `secretaria_` se resuelven aparte en `moduloDeTabla` para no tener
 * que enumerar cada tabla nueva aquí.
 */
export const TABLAS_POR_MODULO: Record<Modulo, string[]> = {
  aims: ["ai_systems", "ai_risk_assessments", "ai_compliance_checks", "ai_incidents"],
  grc: [
    "obligations",
    "controls",
    "risks",
    "findings",
    "action_plans",
    "incidents",
    "exceptions",
    "policies_obligations",
    "capability_matrix",
  ],
  secretaria: [
    "agreements",
    "meetings",
    "minutes",
    "certifications",
    "meeting_resolutions",
    "meeting_attendees",
    "registry_filings",
    "no_session_resolutions",
    "unipersonal_decisions",
  ],
};

const PREFIJO_POR_MODULO: Array<[RegExp, Modulo]> = [
  [/^aims_/, "aims"],
  [/^grc_/, "grc"],
  [/^secretaria_/, "secretaria"],
];

/** El módulo dueño de una tabla, o null si es núcleo compartido (sin dueño). */
export function moduloDeTabla(tabla: string): Modulo | null {
  const limpio = tabla.replace(/^public\./, "").trim();
  for (const [modulo, tablas] of Object.entries(TABLAS_POR_MODULO) as Array<[Modulo, string[]]>) {
    if (tablas.includes(limpio)) return modulo;
  }
  for (const [re, modulo] of PREFIJO_POR_MODULO) {
    if (re.test(limpio)) return modulo;
  }
  return null;
}

/** El módulo dueño de una función por su prefijo (`fn_aims_`, `fn_grc_`, `fn_secretaria_`). */
export function moduloDeFuncion(nombreFuncion: string): Modulo | null {
  const limpio = nombreFuncion.replace(/^public\./, "").trim();
  if (limpio.startsWith("fn_aims_")) return "aims";
  if (limpio.startsWith("fn_grc_")) return "grc";
  if (limpio.startsWith("fn_secretaria_")) return "secretaria";
  return null;
}

/**
 * Handoffs declarados por el contrato (C-04): funciones de UN módulo
 * autorizadas a escribir en tablas de otro módulo, y en cuáles.
 *
 * Añadir aquí un nombre nuevo es la ÚNICA forma legítima de que el escáner
 * deje pasar una escritura cruzada — nunca renombrar la tabla o la función
 * para esquivarlo.
 */
export const HANDOFFS_DECLARADOS: Record<string, Modulo[]> = {
  // F5.T8 (fuera de esta tarea, declarado para cuando exista): un hallazgo del
  // art. 5 detectado en AIMS crea su hallazgo y acción en GRC.
  fn_grc_registrar_hallazgo_ia: ["grc"],
  // F5.T10 (fuera de esta tarea): enlaza controles/obligaciones de GRC con
  // sistemas de IA sin mover la FK del control.
  fn_grc_vincular_ia: ["grc"],
  // F5.T13 (fuera de esta tarea): el dictamen del Comité de IA se registra
  // como documento de Secretaría.
  fn_secretaria_registrar_dictamen_ia: ["secretaria"],
};

export interface ViolacionFrontera {
  archivo: string;
  funcion: string;
  moduloFuncion: Modulo;
  tabla: string;
  moduloTabla: Modulo;
  sentencia: string;
}

/**
 * Un candidato de escritura (INSERT/UPDATE/DELETE) encontrado dentro de una
 * función, ya recortado del texto de la migración. La extracción del texto
 * (que sí necesita `node:fs`) vive en el test — esta función solo decide si,
 * dados nombre de función + tabla, la escritura está permitida.
 */
export function esEscrituraPermitida(nombreFuncion: string, tabla: string): boolean {
  const moduloFuncion = moduloDeFuncion(nombreFuncion);
  const moduloTabla = moduloDeTabla(tabla);
  // Sin dueño reconocido en alguno de los dos lados: no es una violación de
  // frontera (tabla núcleo, o función utilitaria fuera de los tres módulos).
  if (moduloFuncion === null || moduloTabla === null) return true;
  if (moduloFuncion === moduloTabla) return true;
  return (HANDOFFS_DECLARADOS[nombreFuncion] ?? []).includes(moduloTabla);
}
