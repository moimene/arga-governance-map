/**
 * F5.T6 (MOI-175) — criterio de si el control del art. 4 RIA (alfabetización,
 * `OBL-RIA-ORG-04`) tiene evidencia que acredite una efectividad.
 *
 * Harvey (C14): el art. 4 es una obligación de MEDIOS. Se acredita con las
 * MEDIDAS ADOPTADAS —formación impartida, con su versión de contenido—, nunca
 * con un nivel de conocimiento garantizado ni con un porcentaje. Por eso este
 * módulo no tiene ningún campo de nivel/porcentaje y no lo va a tener: la
 * pregunta que resuelve es "¿hay al menos una medida registrada?", no "¿cuán
 * buena es la medida?".
 *
 * `EstadoControlFormacion` deliberadamente NO incluye ningún valor que
 * `controls.status` no admita (Efectivo | Parcial | Inefectivo, CHECK de
 * Cloud) más un cuarto estado neutro para "sin ninguna medida registrada
 * todavía" — que es justo lo que el gate protege que nunca se pinte como si
 * fuera de los otros tres.
 */

export interface RegistroFormacion {
  /** Presencia basta: no se lee ningún campo de nivel ni de porcentaje. */
  id: string;
}

export type EstadoControlFormacion = "SIN_MEDIR" | "Efectivo" | "Parcial" | "Inefectivo";

/**
 * Sin ningún registro, no hay nada que acredite el control: `SIN_MEDIR`, y
 * NUNCA uno de los tres valores reales del CHECK. Con al menos uno, el
 * control se acredita como `Efectivo` — la existencia de la medida adoptada
 * ES la evidencia (Harvey C14), no una lectura de "cuánta" formación hubo.
 */
export function estadoControlPorFormacion(registros: RegistroFormacion[]): EstadoControlFormacion {
  return registros.length === 0 ? "SIN_MEDIR" : "Efectivo";
}

/** Lo que una pantalla puede pintar como "control acreditado". Excluye SIN_MEDIR a propósito. */
export const ESTADOS_CONTROL_MEDIDO: readonly EstadoControlFormacion[] = ["Efectivo", "Parcial", "Inefectivo"];

export function esEfectividadMedida(estado: EstadoControlFormacion): boolean {
  return (ESTADOS_CONTROL_MEDIDO as readonly string[]).includes(estado);
}
