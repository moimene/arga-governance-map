import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { archiveStandaloneCertificationDocument } from "@/lib/secretaria/standalone-certifications/document";

export interface StandaloneCertificationKindRow {
  id: string;
  tenant_id: string;
  kind_code: string;
  label: string;
  source_domain: string;
  legal_effect: string;
  requires_visto_bueno: boolean;
  requires_rm_reference: boolean;
  requires_qes: boolean;
  template_binding_key: string | null;
  authority_policy: Record<string, unknown>;
  disclaimer_policy: Record<string, unknown>;
  is_active: boolean;
}

export interface StandaloneCertificationRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id: string | null;
  kind_code: string;
  source_domain: string;
  source_id: string | null;
  source_payload: unknown;
  source_hash: string;
  source_summary: Record<string, unknown>;
  cutoff_at: string;
  issued_to: string | null;
  legal_effect: string;
  capa3_payload: Record<string, unknown>;
  certificante_role: string;
  authority_evidence_id: string | null;
  visto_bueno_persona_id: string | null;
  requires_visto_bueno: boolean;
  requires_qes: boolean;
  signature_status: string;
  artifact_id: string | null;
  evidence_bundle_id: string | null;
  status: string;
  emitted_at: string | null;
  created_at: string;
  artifact?: {
    id: string;
    title: string;
    status: string;
    evidence_status: string;
    document_url: string | null;
    content_hash: string | null;
    hash_sha512: string | null;
    evidence_bundle_id: string | null;
    metadata: Record<string, unknown>;
  } | null;
  kind?: StandaloneCertificationKindRow | null;
}

export interface PreparedStandaloneCertificationSource {
  tenant_id: string;
  entity_id: string;
  body_id?: string | null;
  kind_code: string;
  kind_label: string;
  source_domain: string;
  source_id?: string | null;
  source_payload: unknown;
  source_hash: string;
  source_summary: Record<string, unknown>;
  cutoff_at: string;
  legal_effect: string;
  requires_visto_bueno: boolean;
  requires_rm_reference: boolean;
  requires_qes: boolean;
  template_binding_key?: string | null;
  disclaimer_policy?: Record<string, unknown>;
}

export function useStandaloneCertificationKinds() {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId,
    queryKey: ["standalone_certification_kinds", tenantId],
    queryFn: async (): Promise<StandaloneCertificationKindRow[]> => {
      const { data, error } = await supabase
        .from("standalone_certification_kinds")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("kind_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StandaloneCertificationKindRow[];
    },
  });
}

export function useStandaloneCertifications(filters?: { entityId?: string | null; kindCode?: string | null }) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId,
    queryKey: ["standalone_certifications", tenantId, filters?.entityId ?? "all", filters?.kindCode ?? "all"],
    queryFn: async (): Promise<StandaloneCertificationRow[]> => {
      let query = supabase
        .from("standalone_certifications")
        .select(`
          *,
          artifact:artifact_id(id,title,status,evidence_status,document_url,content_hash,hash_sha512,evidence_bundle_id,metadata),
          kind:kind_id(*)
        `)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (filters?.entityId) query = query.eq("entity_id", filters.entityId);
      if (filters?.kindCode) query = query.eq("kind_code", filters.kindCode);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as StandaloneCertificationRow[];
    },
  });
}

export function useGenerateStandaloneCertificationDocument() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (params: {
      certification: StandaloneCertificationRow;
      entityName?: string | null;
    }) =>
      archiveStandaloneCertificationDocument({
        certification: params.certification,
        entityName: params.entityName,
        signedBy: "SISTEMA",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standalone_certifications", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function usePrepareStandaloneCertificationSource() {
  return useMutation({
    mutationFn: async (params: {
      kindCode: string;
      sourceInput: Record<string, unknown>;
    }): Promise<PreparedStandaloneCertificationSource> => {
      const { data, error } = await supabase.rpc("fn_prepare_standalone_certification_source", {
        p_kind: params.kindCode,
        p_source_input: params.sourceInput,
      });
      if (error) throw error;
      return data as PreparedStandaloneCertificationSource;
    },
  });
}

export function useCreateStandaloneCertification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (params: {
      kindCode: string;
      sourceInput: Record<string, unknown>;
      cutoffAt?: string | null;
      issuedTo?: string | null;
      capa3?: Record<string, unknown>;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc("fn_create_standalone_certification", {
        p_kind: params.kindCode,
        p_source_input: params.sourceInput,
        p_cutoff_at: params.cutoffAt ?? null,
        p_issued_to: params.issuedTo ?? null,
        p_capa3: params.capa3 ?? {},
      });
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standalone_certifications", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function useEmitStandaloneCertification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (params: { certificationId: string; artifactId?: string | null }): Promise<string> => {
      const { data, error } = await supabase.rpc("fn_emit_standalone_certification", {
        p_certification_id: params.certificationId,
        p_artifact_id: params.artifactId ?? null,
      });
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standalone_certifications", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function useSupersedeStandaloneCertification() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (params: { certificationId: string; reason: string }): Promise<string> => {
      const { data, error } = await supabase.rpc("fn_supersede_standalone_certification", {
        p_certification_id: params.certificationId,
        p_reason: params.reason,
      });
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standalone_certifications", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}
