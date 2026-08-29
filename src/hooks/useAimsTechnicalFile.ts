import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .select("*")
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("aims_technical_file_sections query notice:", error.message);
        return [];
      }
      return (data ?? []) as AimsTechnicalFileSection[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

/**
 * Versiones técnicas del sistema de IA
 */
export function useAimsSystemVersions(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_system_versions", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("aims_system_versions")
        .select("*")
        .eq("system_id", systemId)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("aims_system_versions query notice:", error.message);
        return [];
      }
      return (data ?? []) as AimsSystemVersion[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

/**
 * Indicadores de vigilancia poscomercialización
 */
export function useAimsMonitoringIndicators(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_monitoring_indicators", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("aims_monitoring_indicators")
        .select("*")
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("aims_monitoring_indicators query notice:", error.message);
        return [];
      }
      return (data ?? []) as AimsMonitoringIndicator[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

/**
 * Registro de Modelos técnicos
 */
export function useAimsModelRegistry(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_model_registry", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("aims_model_registry")
        .select("*")
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("aims_model_registry query notice:", error.message);
        return [];
      }
      return (data ?? []) as AimsModelRegistryItem[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

/**
 * Registro de Datasets
 */
export function useAimsDatasetRegistry(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_dataset_registry", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("aims_dataset_registry")
        .select("*")
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("aims_dataset_registry query notice:", error.message);
        return [];
      }
      return (data ?? []) as AimsDatasetRegistryItem[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

/**
 * Actualizar una sección del expediente técnico
 */
export function useUpdateTechnicalFileSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AimsTechnicalFileSection> }) => {
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AimsTechnicalFileSection;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["aims_technical_file_sections"] });
      if (data?.system_id) {
        qc.invalidateQueries({ queryKey: ["aims_technical_file_sections", undefined, data.system_id] });
      }
    },
  });
}

/**
 * Precintar / Sellar Expediente Técnico en Ledger WORM (Art. 11 + EAD Trust)
 */
export function useCloseAimsTechnicalFile() {
  const qc = useQueryClient();
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
      qc.invalidateQueries({ queryKey: ["aims_system_versions"] });
      qc.invalidateQueries({ queryKey: ["aims_technical_file_sections"] });
      qc.invalidateQueries({ queryKey: ["evidence_bundles"] });
    },
  });
}
