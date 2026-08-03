import { useQuery } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";

export type AuthoritativeSignatureSourceDomain = "MINUTE" | "CERTIFICATION";

export interface LocalQTSPSignatureRequestRow {
  id: string;
  source_domain: AuthoritativeSignatureSourceDomain;
  source_id: string;
  artifact_kind: "MINUTE_FINAL" | "CERTIFICATION_FINAL";
  content_hash_sha256: string;
  sr_id: string | null;
  sr_status: string;
  evidence_id: string | null;
  evidence_status: string | null;
  requested_at: string;
  completed_at: string | null;
  signatories: Array<Record<string, unknown>>;
  error_message: string | null;
}

/**
 * Recupera la solicitud local mas reciente ligada a una fuente legal.
 * Los identificadores remotos siguen encapsulados en la fila y nunca se
 * reconstruyen en el navegador. Esta consulta permite reanudar el polling tras
 * una recarga sin confundir una solicitud ACTIVE con una firma completada.
 */
export function useLatestQTSPSignatureRequest(
  sourceDomain: AuthoritativeSignatureSourceDomain,
  sourceId?: string | null,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!sourceId,
    queryKey: ["qtsp_signature_requests", tenantId, sourceDomain, sourceId, "latest"],
    queryFn: async (): Promise<LocalQTSPSignatureRequestRow | null> => {
      const { data, error } = await supabase
        .from("qtsp_signature_requests")
        .select(
          "id, source_domain, source_id, artifact_kind, content_hash_sha256, sr_id, sr_status, evidence_id, evidence_status, requested_at, completed_at, signatories, error_message",
        )
        .eq("tenant_id", tenantId!)
        .eq("source_domain", sourceDomain)
        .eq("source_id", sourceId!)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as LocalQTSPSignatureRequestRow | null) ?? null;
    },
  });
}
