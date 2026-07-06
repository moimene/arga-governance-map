/**
 * T11 (run-log UX 2026-06-20 §6.9.4) — Aviso de desfase del marco normativo.
 *
 * Al adoptar un acuerdo se congela el hash del perfil normativo aplicable. Si el
 * marco cambia después, el expediente debe avisar de que la evaluación puede haber
 * quedado desfasada. PERO la comparación solo es válida cuando el hash congelado es
 * CANÓNICO (`normativeFingerprint`): los acuerdos de ORIGEN REUNIÓN congelaron un
 * `payload_hash` de fallback (no comparable con el fingerprint vivo), y compararlos
 * daría FALSOS avisos de desfase. Por eso solo se avisa si el hash congelado es de
 * kind='CANONICAL'. Lógica pura y testeable; no finge criterio jurídico.
 */
export type ProfileHashKind = "CANONICAL" | "PAYLOAD" | string;

export interface DesfaseNormativoInput {
  frozenProfileHash: string | null | undefined;
  frozenProfileHashKind: ProfileHashKind | null | undefined;
  liveProfileHash: string | null | undefined;
}

export interface DesfaseNormativoResult {
  comparable: boolean;
  desfase: boolean;
  mensaje: string | null;
}

export function evaluarDesfaseNormativo(input: DesfaseNormativoInput): DesfaseNormativoResult {
  const { frozenProfileHash, frozenProfileHashKind, liveProfileHash } = input;

  // Solo el hash canónico es comparable con el fingerprint vivo.
  if (frozenProfileHashKind !== "CANONICAL" || !frozenProfileHash || !liveProfileHash) {
    return { comparable: false, desfase: false, mensaje: null };
  }
  if (frozenProfileHash === liveProfileHash) {
    return { comparable: true, desfase: false, mensaje: null };
  }
  return {
    comparable: true,
    desfase: true,
    mensaje:
      "El marco normativo aplicable ha cambiado desde que se adoptó este acuerdo. " +
      "Revisa si la evaluación de validez sigue vigente antes de certificar o inscribir.",
  };
}
