import { useQuery, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface FriaAssessment {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id: string | null;
  title: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED";
  version_number: number;
  assessed_by: string | null;
  approved_by_dpo: string | null;
  approved_by_ai_officer: string | null;
  fria_summary: string | null;
  market_surveillance_notified: boolean;
  notification_date: string | null;
  // `qseal_token` / `tsq_token` NO existen en `aims_fria_assessments`: la
  // migración las retiró a propósito (verificado en Cloud, 2026-09-05).
  // Declararlas hacía dos daños: la UI las pintaba como `undefined`, y un sello
  // cualificado y un sello de tiempo son exactamente el tipo de afirmación que
  // este producto no puede sostener. No se reintroducen.
  created_at: string;
  updated_at: string;
}

export interface FriaProcessMapItem {
  id: string;
  fria_id: string;
  business_process: string;
  intended_purpose: string;
  decision_point: string;
  human_role: string | null;
  integration_notes: string | null;
}

export interface FriaUseProfile {
  id: string;
  fria_id: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  usage_frequency: "CONTINUOUS" | "BATCH_DAILY" | "ON_DEMAND" | "SEASONAL";
  estimated_volume: string | null;
  review_periodicity: string;
}

export interface FriaAffectedGroup {
  id: string;
  fria_id: string;
  group_name: string;
  group_description: string | null;
  impact_type: "DIRECT" | "INDIRECT";
  is_vulnerable_group: boolean;
  vulnerability_factors: string | null;
  is_data_subject_only: boolean;
}

export interface FriaRightsRisk {
  id: string;
  fria_id: string;
  fundamental_right: string;
  harm_scenario: string;
  provider_info_ref: string | null;
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mitigation_measures: string | null;
  residual_risk: string;
}

export interface FriaRemediationGovernance {
  id: string;
  fria_id: string;
  trigger_event: string;
  governance_body: string;
  complaint_channel: string;
  redress_procedure: string;
  rollback_strategy: string | null;
  board_escalation_threshold: string | null;
}

export interface FriaDpiaCrossReference {
  id: string;
  tenant_id: string;
  fria_id: string;
  dpia_ref_id: string;
  ria_obligation_point: "ART_27_1_A" | "ART_27_1_C" | "ART_27_1_D" | "ART_27_1_F";
  dpia_section: string;
  coverage_type: "FULL" | "PARTIAL";
  source_hash: string | null;
  validation_status: "VALID" | "IN_REVIEW" | "REVOKED";
  dpo_signoff_by: string | null;
  ai_officer_signoff_by: string | null;
  notes: string | null;
}

/**
 * Consulta la FRIA asociada a un sistema de IA.
 */
export function useFriaBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<FriaAssessment | null>({
    queryKey: ["aims_fria_assessments", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_fria_assessments" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as FriaAssessment | null;
    } : skipToken,
  });
}

/**
 * Consulta los 6 bloques y las referencias cruzadas FRIA-EIPD de una FRIA.
 */
export function useFriaDetails(friaId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<{
    processes: FriaProcessMapItem[];
    useProfile: FriaUseProfile | null;
    affectedGroups: FriaAffectedGroup[];
    rightsRisks: FriaRightsRisk[];
    remediation: FriaRemediationGovernance | null;
    crossReferences: FriaDpiaCrossReference[];
  }>({
    queryKey: ["aims_fria_details", tenantId, friaId],
    queryFn: tenantId && friaId ? async () => {
      const [pRes, uRes, gRes, rRes, remRes, xRes] = await Promise.all([
        supabase.from("aims_fria_process_map" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase.from("aims_fria_use_profile" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId).maybeSingle(),
        supabase.from("aims_fria_affected_groups" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase.from("aims_fria_fundamental_rights_risks" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase.from("aims_fria_remediation_governance" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId).maybeSingle(),
        supabase.from("aims_fria_dpia_cross_references" as never).select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
      ]);

      // Un fallo de RLS o una tabla ausente no puede presentarse como "no hay datos":
      // la pantalla quedaría vacía y nadie se enteraría.
      for (const res of [pRes, uRes, gRes, rRes, remRes, xRes]) {
        const { error } = res;
        if (error) throw error;
      }

      return {
        processes: (pRes.data || []) as FriaProcessMapItem[],
        useProfile: (uRes.data || null) as FriaUseProfile | null,
        affectedGroups: (gRes.data || []) as FriaAffectedGroup[],
        rightsRisks: (rRes.data || []) as FriaRightsRisk[],
        remediation: (remRes.data || null) as FriaRemediationGovernance | null,
        crossReferences: (xRes.data || []) as FriaDpiaCrossReference[],
      };
    } : skipToken,
  });
}
