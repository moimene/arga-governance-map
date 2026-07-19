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
      return "Firmado por todos los firmantes";
    case "PARCIAL":
      return "Firmado parcialmente — faltan firmantes";
    case "SOLICITADA":
      return "Firma solicitada — pendiente de firma";
    case "SIN_EFECTO":
      return "Solicitud de firma anulada o caducada";
    case "NO_SOLICITADA":
    default:
      return "Sin solicitud de firma";
  }
}

/**
 * Nivel de firma que emite el proveedor, para no afirmar más de lo que es.
 *
 * EAD Enterprise Suite 1.4.2 **no expone tipo cualificado (QES)**: su máximo es
 * `ADVANCED` (avanzada con OTP por SMS, art. 26 eIDAS), e `INTERPOSITION` es
 * firma simple (art. 25.1 eIDAS). Nuestro proxy emite `INTERPOSITION`.
 *
 * Por eso ninguna superficie puede rotular "QES" en este camino. Qué nivel
 * resulta suficiente para actas y certificaciones es criterio del Comité Legal;
 * lo que no admite criterio es llamar cualificada a una firma simple.
 */
export const SIGNATURE_TYPE_LABEL: Readonly<Record<string, string>> = {
  INTERPOSITION: "Firma electrónica simple (art. 25.1 eIDAS)",
  ADVANCED: "Firma electrónica avanzada con OTP (art. 26 eIDAS)",
};

export function signatureTypeLabel(signatureType?: string | null): string {
  const raw = String(signatureType ?? "").trim().toUpperCase();
  return SIGNATURE_TYPE_LABEL[raw] ?? "Firma electrónica";
}
