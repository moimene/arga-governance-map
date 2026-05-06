import { useQuery } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyEntityDemoReadiness,
  type DemoReadiness,
} from "@/lib/secretaria/entity-demo-readiness";

export function useEntityDemoReadiness(entityId: string | null | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery({
    enabled: !!tenantId && !!entityId,
    queryKey: ["entity-demo-readiness", tenantId, entityId],
    queryFn: async (): Promise<DemoReadiness> => {
      const [
        holdingsRes,
        bodiesRes,
        positionsRes,
        authorityRes,
        agreementsRes,
        templatesRes,
      ] = await Promise.all([
        supabase
          .from("capital_holdings")
          .select("id, porcentaje_capital, effective_to")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!),
        supabase
          .from("governing_bodies")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!),
        supabase
          .from("condiciones_persona")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!)
          .eq("estado", "VIGENTE"),
        supabase
          .from("authority_evidence")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!)
          .eq("estado", "VIGENTE"),
        supabase
          .from("agreements")
          .select("id, agreement_kind")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!),
        supabase
          .from("plantillas_protegidas")
          .select("id, estado, tipo, materia, materia_acuerdo")
          .eq("tenant_id", tenantId!)
          .eq("estado", "ACTIVA"),
      ]);

      for (const result of [holdingsRes, bodiesRes, positionsRes, authorityRes, agreementsRes, templatesRes]) {
        if (result.error) throw result.error;
      }

      const bodies = bodiesRes.data ?? [];
      const bodyIds = bodies.map((body) => body.id);
      const meetingsRes = bodyIds.length > 0
        ? await supabase
            .from("meetings")
            .select("id")
            .eq("tenant_id", tenantId!)
            .in("body_id", bodyIds)
        : { data: [], error: null };
      if (meetingsRes.error) throw meetingsRes.error;

      const meetingIds = (meetingsRes.data ?? []).map((meeting) => meeting.id);
      const censusRes = meetingIds.length > 0
        ? await supabase
            .from("censo_snapshot")
            .select("id")
            .eq("tenant_id", tenantId!)
            .in("meeting_id", meetingIds)
        : { data: [], error: null };
      if (censusRes.error) throw censusRes.error;

      const agreementKinds = new Set((agreementsRes.data ?? []).map((agreement) => agreement.agreement_kind).filter(Boolean));
      const compatibleTemplates = (templatesRes.data ?? []).filter((template) => {
        const materia = template.materia ?? template.materia_acuerdo;
        return materia ? agreementKinds.has(materia) : false;
      });

      return classifyEntityDemoReadiness({
        capitalHoldings: holdingsRes.data ?? [],
        governingBodies: bodies,
        activePositions: positionsRes.data ?? [],
        authorityEvidence: authorityRes.data ?? [],
        compatibleTemplates,
        meetings: meetingsRes.data ?? [],
        censusSnapshots: censusRes.data ?? [],
      });
    },
    staleTime: 60_000,
  });
}
