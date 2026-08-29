import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type AimsTechnicalFileSection = {
  id: string;
  system_id: string;
  version_id?: string | null;
  section_key: string;
  section_title: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "NON_CONFORMING" | "SEALED";
  content_summary?: string | null;
  evidence_doc_path?: string | null;
  evidence_doc_hash?: string | null;
  completeness_score?: number | null;
  created_at: string;
  updated_at: string;
};

export type AimsSystemVersion = {
  id: string;
  system_id: string;
  version_tag: string;
  status: "DEVELOPMENT" | "VALIDATION" | "PRODUCTION" | "RETIRED";
  target_readiness_score?: number | null;
  current_readiness_score?: number | null;
  technical_file_status: "OPEN" | "IN_REVIEW" | "SEALED" | "RECTIFIED";
  qseal_token?: string | null;
  sealed_at?: string | null;
  sealed_by?: string | null;
  created_at: string;
};

export type AimsMonitoringIndicator = {
  id: string;
  system_id: string;
  name: string;
  indicator_type: "DRIFT" | "ACCURACY" | "LATENCY" | "FAIRNESS" | "ANOMALY";
  threshold?: string | null;
  current_value?: string | null;
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
  last_evaluated_at?: string | null;
  created_at: string;
};

export type AimsModelRegistryItem = {
  id: string;
  system_id: string;
  model_name: string;
  model_type: string;
  base_architecture?: string | null;
  parameters_count?: string | null;
  training_cutoff?: string | null;
  provider?: string | null;
  created_at: string;
};

export type AimsDatasetRegistryItem = {
  id: string;
  system_id: string;
  dataset_name: string;
  dataset_type: "TRAINING" | "VALIDATION" | "TESTING" | "BENCHMARK";
  records_count?: number | null;
  contains_pii?: boolean | null;
  contains_special_categories?: boolean | null;
  provenance?: string | null;
  created_at: string;
};

/**
 * Secciones del Expediente Técnico (Art. 11 + Anexo IV)
 */
export function useAimsTechnicalFileSections(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_technical_file_sections", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AimsTechnicalFileSection[];
    } : skipToken,
  });
}

/**
 * Versiones técnicas del sistema de IA
 */
export function useAimsSystemVersions(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_system_versions", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_system_versions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AimsSystemVersion[];
    } : skipToken,
  });
}

/**
 * Indicadores de vigilancia poscomercialización
 */
export function useAimsMonitoringIndicators(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_monitoring_indicators", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_monitoring_indicators")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AimsMonitoringIndicator[];
    } : skipToken,
  });
}

/**
 * Registro de Modelos técnicos
 */
export function useAimsModelRegistry(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_model_registry", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_model_registry")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AimsModelRegistryItem[];
    } : skipToken,
  });
}

/**
 * Registro de Datasets
 */
export function useAimsDatasetRegistry(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_dataset_registry", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_dataset_registry")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AimsDatasetRegistryItem[];
    } : skipToken,
  });
}

/**
 * Actualizar una sección del expediente técnico
 */
export function useUpdateTechnicalFileSection() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AimsTechnicalFileSection> }) => {
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .update(updates)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AimsTechnicalFileSection;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["aims_technical_file_sections", tenantId] });
      if (data?.system_id) {
        qc.invalidateQueries({ queryKey: ["aims_technical_file_sections", tenantId, data.system_id] });
      }
    },
  });
}

/**
 * Precintar / Sellar Expediente Técnico en Ledger WORM (Art. 11 + EAD Trust)
 */
export function useCloseAimsTechnicalFile() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async ({
      versionId,
      qsealToken,
      tsqToken,
      signedBy,
    }: {
      versionId: string;
      qsealToken: string;
      tsqToken: string;
      signedBy: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_aims_close_technical_file", {
        p_version_id: versionId,
        p_qseal_token: qsealToken,
        p_tsq_token: tsqToken,
        p_signed_by: signedBy,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aims_system_versions", tenantId] });
      qc.invalidateQueries({ queryKey: ["aims_technical_file_sections", tenantId] });
      qc.invalidateQueries({ queryKey: ["evidence_bundles", tenantId] });
    },
  });
}
