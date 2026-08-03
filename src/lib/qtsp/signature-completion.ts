/**
 * ¿Está la firma realmente producida, o solo solicitada?
 *
 * Es la distinción de la que depende que el sistema no afirme un hecho jurídico
 * falso. El flujo de EAD Trust termina en `activate`: a partir de ahí los
 * firmantes reciben el enlace, pero **nadie ha firmado todavía**. La solicitud
 * queda en `ACTIVE` y el documento en `READY_TO_SIGN`.
 *
 * Hasta ahora el cliente daba la firma por completada al activar, fabricaba la
 * hora de firma y declaraba `sandbox: false`; como el gate de evidencia solo
 * degradaba ante `sandbox === true`, cuatro superficies sellaban evidencia WORM
 * afirmando una firma cualificada que aún no existía.
 *
 * Vocabulario del proveedor (verificado en producción, playbook de integración
 * EAD Trust): la solicitud recorre `DRAFT → ACTIVE → PARTIALLY_SIGNED →
 * COMPLETED`, y cada documento `READY_TO_SIGN → SIGNED`. Solo el estado terminal
 * acredita firma.
 *
 * EAD **no emite webhooks**: el cierre del ciclo exige reconciliación por
 * consulta. Mientras no se reconcilie, el estado honesto es "solicitada".
 */

/** Estados de la solicitud de firma en EAD Trust. */
export type SignatureRequestState =
  | "DRAFT"
  | "ACTIVE"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

/** Lo que el producto puede afirmar sobre una firma. */
export type SignatureOutcome =
  /** Ni siquiera se ha solicitado. */
  | "NO_SOLICITADA"
  /** Solicitada y en curso: los firmantes tienen el enlace, nadie ha firmado. */
  | "SOLICITADA"
  /** Alguien ha firmado, pero faltan firmantes. */
  | "PARCIAL"
  /** Todos han firmado: es el ÚNICO estado que acredita firma. */
  | "COMPLETADA"
  /** Anulada o caducada sin firma. */
  | "SIN_EFECTO";

export function resolveSignatureOutcome(srStatus?: string | null): SignatureOutcome {
  const raw = String(srStatus ?? "").trim().toUpperCase();
  if (!raw) return "NO_SOLICITADA";
  if (raw === "COMPLETED") return "COMPLETADA";
  if (raw === "PARTIALLY_SIGNED") return "PARCIAL";
  if (raw === "CANCELLED" || raw === "EXPIRED") return "SIN_EFECTO";
  // DRAFT y ACTIVE: la solicitud existe, la firma no.
  return "SOLICITADA";
}

/**
 * ¿Puede este resultado sostener evidencia sellada?
 *
 * Solo la firma completada. Cualquier otro estado —incluida `ACTIVE`, que es
 * donde termina nuestro flujo de activación— significa que el documento aún no
 * está firmado, y sellarlo afirmaría lo que no ha ocurrido.
 */
export function isSignatureProduced(srStatus?: string | null): boolean {
  return resolveSignatureOutcome(srStatus) === "COMPLETADA";
}

/**
 * Etiqueta para el abogado. Describe el hecho, sin adjetivar su eficacia: qué
 * nivel de firma se ha obtenido es criterio jurídico y no se decide aquí.
 */
export function signatureOutcomeLabel(outcome: SignatureOutcome): string {
  switch (outcome) {
    case "COMPLETADA":
      return "Actuación EAD completada para todos los intervinientes";
    case "PARCIAL":
      return "Actuación EAD parcial — faltan intervinientes";
    case "SOLICITADA":
      return "Interposición EAD solicitada — pendiente de resultado";
    case "SIN_EFECTO":
      return "Solicitud EAD anulada o caducada";
    case "NO_SOLICITADA":
    default:
      return "Sin solicitud EAD";
  }
}

/**
 * Nivel de firma que emite el proveedor, para no afirmar más de lo que es.
 *
 * Secretaría usa `INTERPOSITION` como modo de actuación del proveedor y no lo
 * traduce a QES, avanzada o simple. Las claves históricas se conservan solo para
 * leer registros anteriores; la interfaz no presenta un nivel eIDAS.
 */
export const SIGNATURE_TYPE_LABEL: Readonly<Record<string, string>> = {
  INTERPOSITION: "Interposición EAD Trust",
  ADVANCED: "Interposición EAD Trust",
};

export function signatureTypeLabel(signatureType?: string | null): string {
  const raw = String(signatureType ?? "").trim().toUpperCase();
  return SIGNATURE_TYPE_LABEL[raw] ?? "Actuación EAD Trust";
}
