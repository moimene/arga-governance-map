/**
 * ¿Qué dice la mesa de control sobre la inscripción registral de un acuerdo?
 *
 * POR QUÉ EXISTE. `ExpedienteAcuerdo` calculaba esa línea SOLO desde
 * `agreements.status`, y nada promueve ese estado cuando el Registro practica
 * el asiento: los tres expedientes INSCRITA de Garrigues (asientos 960/960/961,
 * `registered_at` 13/07/2026, medidos en Cloud 2026-09-05) tienen su acuerdo en
 * ADOPTED, y el panel decía «Inscripción registral pendiente» sobre un acto ya
 * inscrito. Manda el expediente registral, que es el dato real; cuando ambos
 * discrepan se dice que no consta la sincronización, no se elige uno en
 * silencio.
 */
import { isRegistryTerminal } from "./registry-lifecycle";
import { statusLabel } from "./status-labels";

export interface RegistryPendingInput {
  /** ¿La materia exige inscripción? Si no, no hay nada que decir. */
  registryRequired?: boolean | null;
  /** Estado del expediente registral vinculado, si lo hay. */
  filingStatus?: string | null;
  /** Número de asiento, para poder citarlo. */
  inscriptionNumber?: string | null;
  /** Estado del acuerdo (`agreements.status`). */
  agreementStatus?: string | null;
}

/**
 * Texto de la línea «Qué falta», o `null` cuando no procede decir nada.
 */
export function registryPendingNotice(input: RegistryPendingInput): string | null {
  if (!input.registryRequired) return null;

  const registrado = isRegistryTerminal(String(input.filingStatus ?? "")) || input.filingStatus === "PUBLICADA";
  const acuerdoAlDia = input.agreementStatus === "REGISTERED" || input.agreementStatus === "PUBLISHED";

  if (registrado) {
    if (acuerdoAlDia) return null;
    const asiento = input.inscriptionNumber ? ` (nº ${input.inscriptionNumber})` : "";
    return `El expediente registral consta ${statusLabel(input.filingStatus!).toLowerCase()}${asiento}; el estado del acuerdo no lo refleja (sin sincronización acreditada)`;
  }

  return acuerdoAlDia ? null : "Inscripción registral pendiente";
}
