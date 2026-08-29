import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// Los tipos siguientes reflejan las columnas REALES de Cloud
// (`information_schema`, verificado 2026-08-29). La versión anterior declaraba
// 23 columnas inexistentes: como las lecturas usan `select("*")`, no fallaban —
// devolvían filas con otras claves y la UI pintaba `undefined`, incluida una
// afirmación positiva sobre datos personales que no se apoyaba en nada.

export type AimsTechnicalFileSection = {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id?: string | null;
  section_code: string;
  title: string;
  status: string;
  content?: Record<string, unknown> | null;
  evidence_refs?: unknown[] | null;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AimsSystemVersion = {
  id: string;
  tenant_id: string;
  system_id: string;
  version_label: string;
  release_stage?: string | null;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  change_summary?: string | null;
  model_snapshot?: Record<string, unknown> | null;
  dataset_snapshot?: Record<string, unknown> | null;
  control_snapshot?: Record<string, unknown> | null;
  technical_file_status: string;
  created_at: string;
  updated_at: string;
};

export type AimsMonitoringIndicator = {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id?: string | null;
  indicator_name: string;
  metric_key?: string | null;
  threshold_config?: Record<string, unknown> | null;
  current_value?: unknown;            // jsonb en Cloud, no texto
  status: string;
  last_observed_at?: string | null;
  evidence_refs?: unknown[] | null;
  created_at: string;
};

export type AimsModelRegistryItem = {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id?: string | null;
  model_name: string;
  model_type?: string | null;
  provider?: string | null;
  model_version?: string | null;
  intended_use?: string | null;
  performance_metrics?: Record<string, unknown> | null;
  validation_results?: Record<string, unknown> | null;
  limitations?: unknown;              // jsonb en Cloud, no texto
  status?: string | null;
  created_at: string;
};

export type AimsDatasetRegistryItem = {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id?: string | null;
  dataset_name: string;
  dataset_type?: string | null;
  source_system?: string | null;
  lawful_basis?: string | null;
  data_categories?: unknown[] | null;
  lineage?: Record<string, unknown> | null;
  quality_metrics?: Record<string, unknown> | null;
  status?: string | null;
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
 * Cerrar el expediente técnico (art. 11 RIA): registro interno con hash SHA-512.
 * No interviene ningún prestador de confianza: la función no realiza llamada externa.
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
      qsealToken?: string;
      tsqToken?: string;
      signedBy?: string;
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
