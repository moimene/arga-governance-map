// ============================================================
// QTSP Proxy Client — invoca la Edge Function `qtsp-proxy`
//
// El cliente EAD Trust real (ead-trust-client.ts) usa Okta client_credentials
// y NO puede correr en browser (el secret vive server-side). Esta capa invoca
// la Edge Function `qtsp-proxy`, que ejecuta el mismo flujo QES de 6 pasos
// contra la Digital Trust API con los secretos provisionados en Supabase.
//
// Contrato de fallback: si el proxy no está desplegado o no está configurado
// (503 QTSP_PROXY_NOT_CONFIGURED / función ausente), las funciones devuelven
// `null` y el caller (useQTSPSign) mantiene su semántica actual: intento
// browser → QTSP_SERVER_PROXY_REQUIRED → sandbox solo en dev/flag explícito.
// Nunca se devuelve un resultado "exitoso" fabricado desde aquí.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type { QESSignFlowResult } from "./ead-trust-client";

const EDGE_FUNCTION_NAME = "qtsp-proxy";
const BASE64_CHUNK = 0x8000; // 32K — evita reventar la pila con String.fromCharCode

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

export interface ProxySignInput {
  documentName: string;
  documentData: ArrayBuffer;
  signatories: Array<{ name: string; email: string; surnames?: string; sequence?: number }>;
  createdBy: string;
  agreementId?: string;
}

export function buildProxySignPayload(input: ProxySignInput) {
  return {
    action: "sign" as const,
    documentName: input.documentName,
    documentBase64: arrayBufferToBase64(input.documentData),
    signatories: input.signatories,
    createdBy: input.createdBy,
    agreementId: input.agreementId,
  };
}

export function normalizeProxySignResult(data: unknown): QESSignFlowResult | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (typeof r.srId !== "string" || typeof r.documentId !== "string" || typeof r.documentHash !== "string") {
    return null;
  }
  return {
    srId: r.srId,
    srStatus: typeof r.srStatus === "string" ? r.srStatus : "ACTIVE",
    documentId: r.documentId,
    documentHash: r.documentHash,
    signatoryIds: Array.isArray(r.signatoryIds) ? (r.signatoryIds as string[]) : [],
  };
}

/**
 * Intenta la firma QES real vía Edge Function.
 * @returns el resultado del flujo, o `null` si el proxy no está disponible/configurado
 *          (el caller decide el fallback). Lanza si el proxy SÍ está configurado
 *          pero el flujo QTSP falla — un fallo real no debe degradar a sandbox.
 */
export async function invokeQTSPProxySign(
  input: ProxySignInput,
  onProgress?: (step: string) => void,
): Promise<QESSignFlowResult | null> {
  onProgress?.("Contactando proxy QTSP (EAD Trust)…");
  let data: unknown;
  let error: { message?: string; context?: { status?: number } } | null;
  try {
    const res = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
      body: buildProxySignPayload(input),
    });
    data = res.data;
    error = res.error as typeof error;
  } catch {
    // Red caída / función no desplegada → fallback silencioso del caller.
    return null;
  }

  if (error) {
    // 503 = proxy sin secretos (no configurado) · 404 = función no desplegada.
    const status = error.context?.status;
    if (status === 503 || status === 404) return null;
    const detail = (data as { error?: string } | null)?.error ?? error.message ?? "error desconocido";
    throw new Error(`QTSP proxy: ${detail}`);
  }

  const notConfigured = (data as { code?: string } | null)?.code === "QTSP_PROXY_NOT_CONFIGURED";
  if (notConfigured) return null;

  const result = normalizeProxySignResult(data);
  if (!result) {
    throw new Error("QTSP proxy: respuesta inválida del flujo de firma");
  }
  onProgress?.("Solicitud de firma QES activada (EAD Trust).");
  return result;
}
