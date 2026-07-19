// ============================================================
// Evidence sandbox gate — Codex adversarial review #2
// ============================================================
// Un resultado de firma/notificación QTSP en modo SANDBOX (cuando el proxy o las
// credenciales de EAD Trust no están disponibles y `useQTSPSign` cae al adaptador
// de demo) NO representa una transacción QES/ERDS real. Por tanto NUNCA debe
// persistirse como evidencia SEALED/WORM "final".
//
// `evidence_bundles.status` está acotado por CHECK a ('OPEN','SEALED','VERIFIED')
// y la RPC `fn_create_governance_evidence_bundle` lanza excepción para cualquier
// otro valor; además solo fija `signature_date` cuando el status es SEALED/VERIFIED.
// Para resultados sandbox forzamos `OPEN` (no-final, sin signature_date) y marcamos
// el manifest con `sandbox: true`, de modo que la UI no muestre el badge SEALED y la
// cadena de custodia deje constancia explícita de que NO es evidencia cualificada.
//
// Este módulo es PURO (sin dependencias de Supabase/React) para poder testear el
// gate de forma aislada — ver `__tests__/evidence-sandbox-gate.test.ts`.

export interface EvidencePersistenceInput {
  /** true si el resultado de firma/notificación proviene del adaptador sandbox de demo. */
  sandbox?: boolean;
  /**
   * Estado de la solicitud de firma en el QTSP (`DRAFT`/`ACTIVE`/
   * `PARTIALLY_SIGNED`/`COMPLETED`…).
   *
   * Este gate nació mirando solo `sandbox`, y esa era la mitad del problema: el
   * camino REAL termina en `activate` y devuelve `ACTIVE`, que significa que los
   * firmantes han recibido el enlace y **nadie ha firmado todavía**. Como
   * `sandbox` era false, la evidencia se sellaba afirmando una firma que no
   * existía. Sin este dato el gate no puede distinguir "firmado" de "solicitado".
   */
  srStatus?: string | null;
  /** status solicitado por el caller (por defecto SEALED para evidencia real). */
  status?: string;
  /** manifest de la evidencia (se le añade el marcador sandbox cuando aplica). */
  manifest: Record<string, unknown>;
}

export interface EvidencePersistenceResolution {
  status: string;
  manifest: Record<string, unknown>;
}

import {
  isSignatureProduced,
  resolveSignatureOutcome,
} from "@/lib/qtsp/signature-completion";

export const SANDBOX_EVIDENCE_STATUS = "OPEN" as const;
/** Firma real solicitada pero no producida: evidencia abierta, nunca sellada. */
export const PENDING_SIGNATURE_EVIDENCE_STATUS = "OPEN" as const;
export const PENDING_SIGNATURE_EVIDENCE_REASON =
  "Solicitud de firma activa en el QTSP: los firmantes han sido notificados pero la firma aun no se ha producido. La evidencia no puede sellarse hasta que la solicitud se complete.";
export const SANDBOX_EVIDENCE_REASON =
  "Firma/notificacion QTSP en modo sandbox de demo; evidencia NO sellada (no es una transaccion EAD Trust real).";

/**
 * Resuelve el status y manifest efectivos antes de persistir una evidencia.
 * Si el origen es sandbox, degrada a `OPEN` y marca el manifest; en caso contrario
 * respeta el status solicitado (SEALED por defecto).
 */
/**
 * Predicado de "evidencia final" (Codex review #2-UI): un evidence bundle solo cuenta
 * como evidencia sellada/WORM definitiva si su status es SEALED o VERIFIED. Los bundles
 * sandbox se persisten como OPEN (ver resolveSandboxSafeEvidencePersistence) y NO deben
 * presentarse como finales en la UI (badges SEALED/QSeal, contadores de certificados).
 */
export function isFinalSealedEvidence(status?: string | null): boolean {
  return status === "SEALED" || status === "VERIFIED";
}

export function resolveSandboxSafeEvidencePersistence(
  input: EvidencePersistenceInput,
): EvidencePersistenceResolution {
  if (input.sandbox === true) {
    return {
      status: SANDBOX_EVIDENCE_STATUS,
      manifest: {
        ...input.manifest,
        sandbox: true,
        sandbox_reason: SANDBOX_EVIDENCE_REASON,
      },
    };
  }

  // Firma real pero AÚN NO PRODUCIDA: `activate` deja la solicitud en `ACTIVE`,
  // con los firmantes notificados y el documento sin firmar. Sellar aquí sería
  // afirmar un hecho que no ha ocurrido, así que la evidencia queda abierta y el
  // manifest deja constancia del estado real en el proveedor.
  if (input.srStatus !== undefined && !isSignatureProduced(input.srStatus)) {
    const outcome = resolveSignatureOutcome(input.srStatus);
    return {
      status: PENDING_SIGNATURE_EVIDENCE_STATUS,
      manifest: {
        ...input.manifest,
        signature_outcome: outcome,
        signature_provider_status: String(input.srStatus ?? "").toUpperCase() || null,
        pending_signature_reason: PENDING_SIGNATURE_EVIDENCE_REASON,
      },
    };
  }

  return {
    status: input.status ?? "SEALED",
    manifest: input.manifest,
  };
}
