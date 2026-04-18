import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface JurisdictionRuleSet {
  id: string;
  tenant_id: string;
  jurisdiction: string;
  company_form: string;
  body_type: string | null;
  rule_set_version: string;
  effective_from: string;
  effective_to: string | null;
  rule_config: {
    notice_periods_days?: Record<string, number>;
    quorum_rules?: Record<string, number>;
    majority_rules?: Record<string, number | string>;
    second_call?: { enabled: boolean; min_interval_hours?: number; reinforced?: boolean };
    inscribable_matters?: string[];
    publication_channels?: string[];
    registry_filing_types?: Record<string, string>;
  };
  legal_reference: string | null;
  created_at: string;
}

export interface QuorumStatusResult {
  status: "OK" | "WARNING" | "ERROR";
  present: number;
  required: number;
  required_pct: number;
  message: string;
}

export interface NoticePeriodResult {
  status: "OK" | "WARNING" | "ERROR";
  required_days: number;
  actual_days: number;
  message: string;
}

/** All jurisdiction rule sets. */
export function useJurisdiccionRules() {
  return useQuery({
    queryKey: ["jurisdiction_rule_sets", "all"],
    queryFn: async (): Promise<JurisdictionRuleSet[]> => {
      const { data, error } = await supabase
        .from("jurisdiction_rule_sets")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .order("jurisdiction", { ascending: true });
      if (error) throw error;
      return (data ?? []) as JurisdictionRuleSet[];
    },
  });
}

/** Applicable rule set(s) for an entity's jurisdiction + company_form. */
export function useEntityRules(jurisdictionCode?: string, companyForm?: string) {
  return useQuery({
    enabled: !!jurisdictionCode && !!companyForm,
    queryKey: ["jurisdiction_rule_sets", "forEntity", jurisdictionCode, companyForm],
    queryFn: async (): Promise<JurisdictionRuleSet[]> => {
      const { data, error } = await supabase
        .from("jurisdiction_rule_sets")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .eq("jurisdiction", jurisdictionCode!)
        .eq("company_form", companyForm!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as JurisdictionRuleSet[];
    },
  });
}

/**
 * Compute quorum status for a meeting.
 * @param presentCount Number of attendees present (or represented)
 * @param totalCount Total members
 * @param ruleSet Applicable rule set
 * @param matterClass ORDINARIA | ESTATUTARIA | ESTRUCTURAL
 * @param callNumber 1 = primera convocatoria, 2 = segunda
 */
export function computeQuorumStatus(
  presentCount: number,
  totalCount: number,
  ruleSet: JurisdictionRuleSet | null | undefined,
  matterClass: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL",
  callNumber: 1 | 2 = 1
): QuorumStatusResult {
  if (!ruleSet || !ruleSet.rule_config?.quorum_rules) {
    return {
      status: "WARNING",
      present: presentCount,
      required: 0,
      required_pct: 0,
      message: "Sin regla aplicable — verificar manualmente",
    };
  }

  const rules = ruleSet.rule_config.quorum_rules;
  const key = callNumber === 2 ? `${matterClass}_2` : matterClass;
  const rulePct = rules[key] ?? rules[matterClass] ?? 0;

  const requiredPct = typeof rulePct === "number" ? rulePct : 0;
  const required = Math.ceil((totalCount * requiredPct) / 100);
  const actualPct = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

  if (presentCount >= required) {
    return {
      status: "OK",
      present: presentCount,
      required,
      required_pct: requiredPct,
      message: `Quórum cubierto (${actualPct.toFixed(1)}% ≥ ${requiredPct}%)`,
    };
  }

  return {
    status: "ERROR",
    present: presentCount,
    required,
    required_pct: requiredPct,
    message: `Quórum insuficiente (${actualPct.toFixed(1)}% < ${requiredPct}%)`,
  };
}

/**
 * Check if notice period between convocation and meeting is compliant.
 * @param convocationDate ISO date string (fecha de convocatoria)
 * @param meetingDate ISO date string (fecha de reunión)
 * @param ruleSet Applicable rule set
 * @param meetingType JGA | JGE | CDA | COMISION
 */
export function checkNoticePeriod(
  convocationDate: string,
  meetingDate: string,
  ruleSet: JurisdictionRuleSet | null | undefined,
  meetingType: "JGA" | "JGE" | "CDA" | "COMISION"
): NoticePeriodResult {
  const conv = new Date(convocationDate);
  const meet = new Date(meetingDate);
  const actualDays = Math.floor((meet.getTime() - conv.getTime()) / (1000 * 60 * 60 * 24));

  if (!ruleSet || !ruleSet.rule_config?.notice_periods_days) {
    return {
      status: "WARNING",
      required_days: 0,
      actual_days: actualDays,
      message: "Sin regla aplicable — verificar plazo manualmente",
    };
  }

  const periods = ruleSet.rule_config.notice_periods_days;
  const requiredDays = periods[meetingType] ?? 0;

  if (actualDays >= requiredDays) {
    return {
      status: "OK",
      required_days: requiredDays,
      actual_days: actualDays,
      message: `Plazo cumplido (${actualDays} días ≥ ${requiredDays} días)`,
    };
  }

  return {
    status: "ERROR",
    required_days: requiredDays,
    actual_days: actualDays,
    message: `Plazo insuficiente (${actualDays} días < ${requiredDays} días requeridos)`,
  };
}

/**
 * Check if notice period is compliant using hardcoded minimum days per
 * jurisdiction + convocation type (no rule set required — for ConvocatoriasStepper).
 * Returns true if the meeting date is far enough in the future.
 */
export function checkNoticePeriodByType(params: {
  meetingDate: string;       // ISO date
  jurisdiction: string;      // 'ES' | 'BR' | 'MX' | 'PT'
  convocationType: string;   // 'ORDINARIA' | 'EXTRAORDINARIA' | 'UNIVERSAL'
}): boolean {
  if (params.convocationType === "UNIVERSAL") return true; // no requiere plazo
  const today = new Date();
  const meeting = new Date(params.meetingDate);
  const diffDays = Math.floor((meeting.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const minDays: Record<string, Record<string, number>> = {
    ES: { ORDINARIA: 15, EXTRAORDINARIA: 5 },
    BR: { ORDINARIA: 8,  EXTRAORDINARIA: 3 },
    MX: { ORDINARIA: 15, EXTRAORDINARIA: 8 },
    PT: { ORDINARIA: 21, EXTRAORDINARIA: 8 },
  };
  const required = minDays[params.jurisdiction]?.[params.convocationType] ?? 15;
  return diffDays >= required;
}

/**
 * Determine if a matter is inscribable (requires registry filing).
 */
export function isInscribableMatter(
  agreementKind: string,
  ruleSet: JurisdictionRuleSet | null | undefined
): boolean {
  if (!ruleSet?.rule_config?.inscribable_matters) return false;
  return ruleSet.rule_config.inscribable_matters.includes(agreementKind);
}
