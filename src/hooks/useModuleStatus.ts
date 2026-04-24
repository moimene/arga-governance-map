import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type ModuleStatus = {
  secretaria: {
    convocatoriasEmitidas: number;
    acuerdosPendientes: number;
  };
  grc: {
    incidentesDoraAbiertos: number;
    notificacionesUrgentes: number;
  };
  aiGovernance: {
    altosNoAprobados: number;
    incidentesAbiertos: number;
  };
  sii: {
    casosAbiertos: number;
  };
};

export function useModuleStatus() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["module_status", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ModuleStatus> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const h72 = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const [
        convRes,
        acuerdosRes,
        incidentesDoraRes,
        notifRes,
        aiSystemsRes,
        aiAssessApprovedRes,
        aiIncRes,
        siiRes,
      ] = await Promise.all([
        // Secretaría: convocatorias EMITIDAS este mes
        // OJO: la columna real es `estado`, no `status`.
        supabase
          .from("convocatorias")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("estado", "EMITIDA")
          .gte("created_at", startOfMonth),

        // Secretaría: acuerdos pendientes de inscripción
        // Solo inscribibles en estados pre-registrales (no cuenta PUBLISHED/REGISTERED ni DRAFT/PROPOSED)
        supabase
          .from("agreements")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("inscribable", true)
          .in("status", ["ADOPTED", "CERTIFIED", "INSTRUMENTED", "FILED", "REJECTED_REGISTRY"]),

        // GRC: incidentes DORA abiertos
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .ilike("module_id", "%dora%")
          .in("status", ["OPEN", "ABIERTO", "IN_PROGRESS"]),

        // GRC: notificaciones regulatorias con deadline < 72h
        supabase
          .from("regulatory_notifications")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .lte("deadline", h72)
          .gt("deadline", now.toISOString()),

        // AI: sistemas con riesgo Alto
        supabase
          .from("ai_systems")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("risk_level", "Alto"),

        // AI: evaluaciones aprobadas (para filtrar sistemas ya evaluados)
        supabase
          .from("ai_risk_assessments")
          .select("system_id")
          .eq("status", "APROBADO"),

        // AI: incidentes abiertos
        supabase
          .from("ai_incidents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("status", ["ABIERTO", "EN_INVESTIGACION"]),

        // SII: casos abiertos
        // sii_cases_view no está en los tipos generados; cast controlado para usar PostgREST.
        (supabase as unknown as { from: (t: string) => {
          select: (c: string, o: { count: "exact"; head: true }) => {
            in: (col: string, vals: string[]) => Promise<{ count: number | null; error: { message: string } | null }>;
          };
        } })
          .from("sii_cases_view")
          .select("id", { count: "exact", head: true })
          .in("status", ["OPEN", "ABIERTO", "PENDING"]),
      ]);

      const altoSysIds = new Set((aiSystemsRes.data ?? []).map((s: { id: string }) => s.id));
      const approvedIds = new Set((aiAssessApprovedRes.data ?? []).map((a: { system_id: string }) => a.system_id));
      const altosNoAprobados = [...altoSysIds].filter((id) => !approvedIds.has(id)).length;

      return {
        secretaria: {
          convocatoriasEmitidas: convRes.count ?? 0,
          acuerdosPendientes: acuerdosRes.count ?? 0,
        },
        grc: {
          incidentesDoraAbiertos: incidentesDoraRes.count ?? 0,
          notificacionesUrgentes: notifRes.count ?? 0,
        },
        aiGovernance: {
          altosNoAprobados,
          incidentesAbiertos: aiIncRes.count ?? 0,
        },
        sii: {
          casosAbiertos: siiRes.count ?? 0,
        },
      };
    },
    staleTime: 60_000,
  });
}
