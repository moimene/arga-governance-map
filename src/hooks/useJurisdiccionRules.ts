import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    quorum_rules?: Record<string, any>;
    majority_rules?: Record<string, any>;
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
 * Determine if a matter is inscribable (requires registry filing).
 */
export function isInscribableMatter(
  agreementKind: string,
  ruleSet: JurisdictionRuleSet | null | undefined
): boolean {
  if (!ruleSet?.rule_config?.inscribable_matters) return false;
  return ruleSet.rule_config.inscribable_matters.includes(agreementKind);
}
