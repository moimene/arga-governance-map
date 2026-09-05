import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export function useGrcKpis(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "kpis", tenantId, entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      let risksQuery = supabase
        .from("risks")
        .select("id, residual_score, assessed_band, status, entity_id")
        .eq("tenant_id", tenantId!);

      if (entityId) {
        risksQuery = risksQuery.eq("entity_id", entityId);
      }

      let incidentsQuery = supabase
        .from("incidents")
        .select("id, status, is_major_incident, entity_id")
        .eq("tenant_id", tenantId!);

      if (entityId) {
        incidentsQuery = incidentsQuery.eq("entity_id", entityId);
      }

      const [risks, incidents, exceptions, regNots] = await Promise.all([
        risksQuery,
        incidentsQuery,
        supabase
          .from("exceptions")
          .select("id, status, expires_at")
          .eq("tenant_id", tenantId!),
        supabase
          .from("regulatory_notifications")
          .select("id, status, notification_deadline")
          .eq("tenant_id", tenantId!),
      ]);

      // `(r.residual_score ?? 0) >= 15` trataba la AUSENCIA de score como un 0,
      // o sea como "no crítico". Con 159 de 167 riesgos de ARGA y los 82 del
      // mapa penal de Garrigues sin residual, la tarjeta decía 0 y el copy
      // remataba "Priorizar mitigación". Ahora se cuentan aparte los que no
      // entran en la escala, y los evaluados por banda ordinal se cuentan por
      // su banda, que es lo único que su fuente publica.
      const riskRows = risks.data ?? [];
      const criticalRisks = riskRows.filter(
        (r) => r.residual_score != null && Number(r.residual_score) >= 15
      ).length;
      const risksSinScore = riskRows.filter((r) => r.residual_score == null).length;
      const risksBandaAlta = riskRows.filter(
        (r) => r.assessed_band === "ROJO" || r.assessed_band === "NARANJA"
      ).length;
      const openIncidents = (incidents.data ?? []).filter(
        (i) => i.status !== "Cerrado"
      ).length;
      const majorOpen = (incidents.data ?? []).filter(
        (i) => i.is_major_incident && i.status !== "Cerrado"
      ).length;
      const pendingExceptions = (exceptions.data ?? []).filter(
        (e) => e.status === "Pendiente"
      ).length;
      const pendingRegNots = (regNots.data ?? []).filter(
        (n) => n.status === "Pendiente"
      ).length;

      return {
        // `null` cuando la consulta falló: un error no se pinta como cero.
        criticalRisks: risks.error ? null : criticalRisks,
        risksSinScore: risks.error ? null : risksSinScore,
        risksBandaAlta: risks.error ? null : risksBandaAlta,
        openIncidents,
        majorOpen,
        pendingExceptions,
        pendingRegNots,
      };
    },
  });
}

/**
 * Los módulos GRC que el tenant tiene DE VERDAD en `grc_modules`. Existe porque
 * el alta de riesgo ofrecía una lista estática (dora/gdpr/cyber/audit/penal)
 * con módulos que Garrigues no tiene, y arrancaba preseleccionando `gdpr`.
 */
export function useGrcModules() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "modules", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grc_modules")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .order("id");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string | null }>;
    },
  });
}
