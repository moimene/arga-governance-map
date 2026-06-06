import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { resolveSandboxSafeEvidencePersistence } from "@/lib/secretaria/evidence-sandbox-gate";

export interface EvidenceBundle {
  id: string;
  tenant_id: string;
  reference_code: string | null;
  document_url: string | null;
  hash_sha512: string | null;
  signed_by: string | null;
  signature_date: string | null;
  chain_of_custody: Record<string, unknown> | null;
  legal_hold: boolean;
  created_at: string;
  // F3.G15 additions:
  storage_path: string | null;
  supersedes_id: string | null;
  manifest: Record<string, unknown> | null;
  manifest_hash: string | null;
  source_module?: string | null;
  source_object_type?: string | null;
  source_object_id?: string | null;
}

export function useEvidenceBundlesList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["evidence_bundles", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<EvidenceBundle[]> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceBundle[];
    },
  });
}

export function useEvidenceBundlesForObject(sourceModule: string, sourceObjectType: string, sourceObjectId: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["evidence_bundles", tenantId, sourceModule, sourceObjectType, sourceObjectId],
    enabled: !!tenantId && !!sourceObjectId,
    queryFn: async (): Promise<EvidenceBundle[]> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("source_module", sourceModule)
        .eq("source_object_type", sourceObjectType)
        .eq("source_object_id", sourceObjectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceBundle[];
    },
  });
}

export function useCreateEvidenceBundle() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (payload: {
      sourceModule: string;
      sourceObjectType: string;
      sourceObjectId: string;
      referenceCode: string;
      manifest: Record<string, any>;
      documentUrl?: string;
      legalHold?: boolean;
      status?: string;
      signedBy?: string;
      /** true si la firma/notificación QTSP fue sandbox de demo (no EAD Trust real).
       *  El gate degrada el bundle a OPEN y lo marca; nunca SEALED. (Codex review #2) */
      sandbox?: boolean;
    }) => {
      // Codex review #2: un resultado sandbox NUNCA se sella como evidencia WORM final.
      const { status: effectiveStatus, manifest: effectiveManifest } =
        resolveSandboxSafeEvidencePersistence({
          sandbox: payload.sandbox,
          status: payload.status,
          manifest: payload.manifest,
        });
      const { data, error } = await supabase.rpc("fn_create_governance_evidence_bundle", {
        p_tenant_id: tenantId!,
        p_source_module: payload.sourceModule,
        p_source_object_type: payload.sourceObjectType,
        p_source_object_id: payload.sourceObjectId,
        p_reference_code: payload.referenceCode,
        p_manifest: effectiveManifest,
        p_document_url: payload.documentUrl ?? null,
        p_legal_hold: payload.legalHold ?? false,
        p_status: effectiveStatus,
        p_signed_by: payload.signedBy ?? "EAD Trust Digital Trust API"
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: ["evidence_bundles", tenantId, variables.sourceModule, variables.sourceObjectType, variables.sourceObjectId]
      });
      qc.invalidateQueries({
        queryKey: ["evidence_bundles", tenantId, "list"]
      });
    }
  });
}

export function useVerifyAuditChain() {
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_verify_audit_chain", {
        p_tenant_id: tenantId!,
      });
      if (error) throw error;
      return data;
    },
  });
}
