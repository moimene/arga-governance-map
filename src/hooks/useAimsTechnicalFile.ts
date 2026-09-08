import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { ANEXO_IV_SECCIONES } from "@/lib/aims/expediente-tecnico";

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
 * Actualiza una sección del expediente técnico.
 *
 * La escritura va acotada por tenant Y por id, y se comprueba que vuelve fila:
 * la RLS filtra un UPDATE ajeno a CERO FILAS SIN ERROR, así que sin esta
 * comprobación una edición de otro entorno se daría por guardada.
 */
export function useUpdateTechnicalFileSection() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async ({ id, content, status }: { id: string; content: Record<string, unknown>; status: string }) => {
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .update({ content, status })
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("No se pudo guardar la sección: no pertenece a este entorno.");
      }
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
 * Crea el esqueleto de las nueve secciones del anexo IV.
 *
 * Sólo se ofrece cuando el sistema no tiene ninguna sección: no completa un
 * expediente a medias ni pisa lo ya sembrado. `status` nace en `PENDING`, que
 * es lo que consta — no se estrena nada como conforme.
 */
export function useIniciarExpedienteTecnico() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (systemId: string) => {
      const { data, error } = await supabase
        .from("aims_technical_file_sections")
        .insert(
          ANEXO_IV_SECCIONES.map((s) => ({
            tenant_id: tenantId!,
            system_id: systemId,
            section_code: s.code,
            title: s.titulo,
            status: "PENDING",
            content: { annex: s.anexo },
          })),
        )
        .select();
      if (error) throw error;
      return (data ?? []) as AimsTechnicalFileSection[];
    },
    onSuccess: (_, systemId) =>
      qc.invalidateQueries({ queryKey: ["aims_technical_file_sections", tenantId, systemId] }),
  });
}

/** Registra una versión del sistema. Registro interno: no sella ni custodia nada. */
export function useRegistrarVersion() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (v: {
      systemId: string;
      versionLabel: string;
      releaseStage: string;
      effectiveFrom: string | null;
      changeSummary: string | null;
    }) => {
      const { data, error } = await supabase
        .from("aims_system_versions")
        .insert({
          tenant_id: tenantId!,
          system_id: v.systemId,
          version_label: v.versionLabel,
          release_stage: v.releaseStage,
          effective_from: v.effectiveFrom,
          change_summary: v.changeSummary,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AimsSystemVersion;
    },
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["aims_system_versions", tenantId, v.systemId] }),
  });
}

/**
 * Registra un indicador de vigilancia poscomercialización.
 *
 * `status` se fija en `OK`, el único valor que la columna escribe por defecto y
 * el único que consta en el dato: ofrecer una escala que la tabla no declara
 * (no hay CHECK) sería inventarla.
 */
export function useRegistrarIndicador() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (v: {
      systemId: string;
      indicatorName: string;
      metricKey: string | null;
      lastObservedAt: string | null;
    }) => {
      const { data, error } = await supabase
        .from("aims_monitoring_indicators")
        .insert({
          tenant_id: tenantId!,
          system_id: v.systemId,
          indicator_name: v.indicatorName,
          metric_key: v.metricKey,
          last_observed_at: v.lastObservedAt,
          status: "OK",
        })
        .select()
        .single();
      if (error) throw error;
      return data as AimsMonitoringIndicator;
    },
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["aims_monitoring_indicators", tenantId, v.systemId] }),
  });
}
